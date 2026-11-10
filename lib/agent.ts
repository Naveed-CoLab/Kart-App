/**
 * Kart agent loop: Claude + tools. Emits UI items as NDJSON while it works.
 * Money-moving actions are delegated to lib/orders.ts, which re-runs the guard.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { readUpload } from "./files";
import { config, hasAnthropic, money, now, uid } from "./config";
import { db, logEvent, mutate } from "./db";
import { getProduct, searchByImage, searchProducts } from "./channel3";
import { decide } from "./guard";
import { autoBuy, credited, fileClaim, KartError } from "./orders";
import { readTool } from "./toolkit";
import { systemPrompt } from "./prompt";
import { eventMark, stepsSince } from "./trace";
import { anthropic } from "./vision";
import type { Chat, Product, UIItem } from "./types";

type Emit = (item: UIItem) => void;

/** Extended thinking on by default (KART_THINKING=off to disable); switched off for the process if the model refuses it. */
let thinkingDisabled = process.env.KART_THINKING === "off";
const thinkingOn = () => !thinkingDisabled;
// Newer Claude models take adaptive thinking (they think when a turn needs it); older ones take a
// token budget. Whatever thinking comes back is shown, alongside Claude's plan before each tool call.
const THINKING_OPTIONS: Record<string, unknown>[] = [
  { thinking: { type: "adaptive", display: "summarized" } },
  { thinking: { type: "adaptive" } },
  { thinking: { type: "enabled", budget_tokens: 1024, display: "summarized" } },
  { thinking: { type: "enabled", budget_tokens: 1024 } },
];
let thinkingChoice = 0;
let thinkingNote = "";
let thinkingSeen = 0;
/** For /api/status: which thinking setting works, and whether Claude actually returned any. */
export const thinkingStatus = () => ({ mode: thinkingDisabled ? "off" : JSON.stringify(THINKING_OPTIONS[thinkingChoice] ?? null), blocksSeen: thinkingSeen, lastError: thinkingNote.slice(0, 200) });
async function withThinking(call: (extra: Record<string, unknown>) => Promise<Anthropic.Message>, plain: () => Promise<Anthropic.Message>) {
  while (thinkingChoice < THINKING_OPTIONS.length) {
    try {
      return await call(THINKING_OPTIONS[thinkingChoice]);
    } catch (e) {
      if (!/thinking|budget|display|adaptive|effort|output_config/i.test((e as Error).message)) throw e;
      thinkingNote = (e as Error).message;
      thinkingChoice++;
    }
  }
  console.warn("[agent] this model doesn't return thinking; the trace shows Kart's steps only.");
  thinkingDisabled = true;
  return plain();
}

const tools: Anthropic.Tool[] = [
  {
    name: "search_products",
    description: "Search real products across thousands of online stores via Channel3. Returns up to 8 in-stock products with price, store, rating, reviews and key features.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for, e.g. 'wireless earbuds for running'" },
        max_price: { type: "number", description: "Maximum price in USD" },
        min_price: { type: "number", description: "Minimum price in USD" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_by_photo",
    description:
      "Search products that look like the photo the user attached (Channel3 image search). Use when the user sends a photo and wants to find, replace or buy that item. Not for damage claims (use start_claim).",
    input_schema: {
      type: "object",
      properties: {
        max_price: { type: "number", description: "Maximum price in USD" },
      },
    },
  },
  {
    name: "recommend_products",
    description: "Show product cards to the user: up to 3 picks from the last search, each with a one-line reason, and one marked as the Kart pick.",
    input_schema: {
      type: "object",
      properties: {
        picks: {
          type: "array",
          items: { type: "object", properties: { product_id: { type: "string" }, reason: { type: "string" } }, required: ["product_id", "reason"] },
          maxItems: 3,
        },
        best_pick_id: { type: "string" },
      },
      required: ["picks", "best_pick_id"],
    },
  },
  {
    name: "check_budget",
    description: "Read-only: check how the shopper's spending rules treat an amount (auto / needs_approval / blocked). Does not buy anything.",
    input_schema: { type: "object", properties: { amount: { type: "number" } }, required: ["amount"] },
  },
  {
    name: "request_purchase",
    description: "Start buying a product the user asked to buy. The server applies the spending rules: auto-buys with the saved PayPal (Agent Mandate), shows a PayPal approval card, or blocks.",
    input_schema: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"] },
  },
  {
    name: "get_orders",
    description: "List the shopper's Kart orders with status (paid, shipped, delivered, refunded, claim_review) and Kart Guarantee credits.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_order_status",
    description: "Get live PayPal status for one Kart order (order + shipment tracking) via the PayPal Agent Toolkit.",
    input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"] },
  },
  {
    name: "start_claim",
    description: "File a damage/wrong-item claim for an order using the photo the user attached. Claude vision + fraud score decide: instant PayPal refund or store review.",
    input_schema: { type: "object", properties: { order_id: { type: "string" }, reason: { type: "string" } }, required: ["order_id", "reason"] },
  },
  {
    name: "create_watch",
    description: "Kart Watch: watch a product and buy it (within the rules) when the price drops to the target.",
    input_schema: { type: "object", properties: { product_id: { type: "string" }, target_price: { type: "number" } }, required: ["product_id", "target_price"] },
  },
];

const STEP_LABEL: Record<string, string> = {
  search_products: "Searching thousands of stores via Channel3",
  search_by_photo: "Matching your photo with Channel3 image search",
  recommend_products: "Comparing ratings, prices and features",
  check_budget: "Checking your spending rules",
  request_purchase: "Applying your spending rules",
  get_orders: "Looking up your orders",
  get_order_status: "Checking PayPal via Agent Toolkit",
  start_claim: "Inspecting your photo with Claude vision",
  create_watch: "Setting up Kart Watch",
};

const compact = (p: Product) => ({
  product_id: p.id,
  title: p.title,
  brand: p.brand,
  store: p.store,
  price: p.price,
  stores_selling_it: p.offers?.length || 1,
  highest_other_store_price: p.offers && p.offers.length > 1 ? p.offers[p.offers.length - 1].price : undefined,
  compare_at_price: p.compareAt ?? undefined,
  rating: p.rating ?? "n/a",
  reviews: p.reviews ?? "n/a",
  features: p.features?.slice(0, 3),
});

async function runTool(name: string, input: any, chat: Chat, emit: Emit): Promise<unknown> {
  switch (name) {
    case "search_products": {
      const max = Number(input.max_price) > 0 ? Math.min(Number(input.max_price), db().rules.perItemMax) : db().rules.perItemMax;
      const r = await searchProducts(String(input.query), max, input.min_price);
      logEvent({ type: "search", reason: `Searched "${input.query}" under $${max} (${r.source}): ${r.products.length} results.` });
      return { source: r.source, count: r.products.length, products: r.products.map(compact) };
    }
    case "search_by_photo": {
      const photo = chat.lastImage ? await readUpload(chat.lastImage.path) : null;
      if (!photo) return { error: "No photo attached. Ask the user to attach a photo." };
      const max = Number(input.max_price) > 0 ? Math.min(Number(input.max_price), db().rules.perItemMax) : db().rules.perItemMax;
      const b64 = photo.toString("base64");
      const r = await searchByImage(b64, max);
      logEvent({ type: "search", reason: `Searched by photo under $${max} (${r.source}): ${r.products.length} results.` });
      return { source: r.source, count: r.products.length, products: r.products.map(compact) };
    }
    case "recommend_products": {
      const picks = (input.picks || []) as { product_id: string; reason: string }[];
      const products = picks.map((p) => getProduct(p.product_id)).filter(Boolean) as Product[];
      if (!products.length) return { error: "None of those product_ids exist. Use ids from search_products." };
      const reasons = Object.fromEntries(picks.map((p) => [p.product_id, p.reason]));
      const best = products.find((p) => p.id === input.best_pick_id)?.id || products[0].id;
      emit({ id: uid("ui_"), kind: "products", products, reasons, bestPickId: best });
      logEvent({ type: "decision", rule: "Top 3 + Kart pick", reason: `Recommended ${products.length} options; Kart pick: ${getProduct(best)?.title}. ${reasons[best] || ""}` });
      return { shown: products.length, best_pick_id: best };
    }
    case "check_budget":
      return decide(Number(input.amount));
    case "request_purchase": {
      const p = getProduct(String(input.product_id));
      if (!p) return { error: "Unknown product_id" };
      const g = decide(p.price);
      logEvent({ type: g.decision === "blocked" ? "blocked" : "decision", amount: p.price, rule: g.rule, reason: g.reason });
      if (g.decision === "blocked") {
        emit({ id: uid("ui_"), kind: "blocked", product: p, reason: g.reason });
        return { result: "blocked", rule: g.rule, reason: g.reason };
      }
      if (g.decision === "auto" && db().rules.mandateActive) {
        try {
          const order = await autoBuy(p.id, chat.id);
          emit({ id: uid("ui_"), kind: "order", order, auto: true });
          return { result: "auto_bought", order_id: order.id, store_order: order.storeOrder?.number, store_checkout_mode: order.storeOrder?.mode, amount: p.price, rule: g.rule, note: "Paid with the saved PayPal and placed on the store. In sandbox the store order is a demo; say so briefly. Undo available for 10 minutes. Covered by Kart Guarantee." };
        } catch (e) {
          // fall through to a one-tap approval card
          console.warn("[agent] auto-buy failed:", (e as Error).message);
          if (e instanceof KartError && e.status === 409 && /out of stock/i.test(e.message)) return { result: "out_of_stock", reason: e.message };
        }
      }
      // The live price check may have updated the product (new store or lower price): show the fresh one.
      const fresh = getProduct(p.id) || p;
      const g2 = decide(fresh.price);
      if (g2.decision === "blocked") {
        emit({ id: uid("ui_"), kind: "blocked", product: fresh, reason: g2.reason });
        return { result: "blocked", rule: g2.rule, reason: g2.reason };
      }
      emit({ id: uid("ui_"), kind: "approval", product: fresh, decision: g2.decision, rule: g2.rule, state: "pending" });
      return {
        result: g.decision === "auto" ? "one_tap_payment_card_shown" : "confirmation_card_shown",
        rule: g.rule,
        reason: g.reason,
        note: db().rules.mandateActive
          ? "A confirmation card is shown. When the user taps Confirm & pay, Kart pays with their saved PayPal. Do not say it's paid yet."
          : "A PayPal checkout card is shown. The user pays once in PayPal (and can save PayPal for one-tap orders next time). Do not say it's paid.",
      };
    }
    case "get_orders":
      return db()
        .orders.slice(0, 12)
        .map((o) => ({ order_id: o.id, title: o.title, price: o.price, status: o.status, store: o.store, tracking: o.trackingNumber, credited_back: credited(o) || undefined }));
    case "get_order_status": {
      const o = db().orders.find((x) => x.id === input.order_id);
      if (!o) return { error: "Unknown order_id" };
      const out: Record<string, unknown> = { kart_status: o.status, tracking: o.trackingNumber };
      if (o.paypalOrderId) out.paypal_order = await readTool("get_order", { id: o.paypalOrderId });
      if (o.paypalCaptureId && o.trackingNumber) out.paypal_tracking = await readTool("get_shipment_tracking", { transaction_id: o.paypalCaptureId });
      const trim = (v: unknown) => JSON.stringify(v).slice(0, 1500);
      return { kart_status: o.status, tracking: o.trackingNumber, paypal_order: trim(out.paypal_order), paypal_tracking: out.paypal_tracking ? trim(out.paypal_tracking) : undefined };
    }
    case "start_claim": {
      if (!chat.lastImage) return { error: "No photo attached. Ask the user to attach a photo of the item." };
      const order = db().orders.find((x) => x.id === input.order_id);
      if (!order) return { error: "Unknown order_id. Call get_orders." };
      try {
        const r = await fileClaim({ orderId: order.id, reason: String(input.reason), imagePath: chat.lastImage.path, mediaType: chat.lastImage.mediaType, chatId: chat.id });
        emit({ id: uid("ui_"), kind: "claim", claim: { ...r.claim, imagePath: null }, order: r.order });
        return { decision: r.claim.decision, risk_score: r.claim.riskScore, threshold: 0.3, vision: r.claim.vision, refund_id: r.claim.refundId, paid_back: r.claim.decision === "auto_refund" ? r.order.credits.at(-1)?.amount : 0 };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }
    case "create_watch": {
      const p = getProduct(String(input.product_id));
      if (!p) return { error: "Unknown product_id" };
      const w = { id: uid("w_"), productId: p.id, title: p.title, targetPrice: Number(input.target_price), status: "watching" as const, lastPrice: p.price, createdAt: now() };
      mutate((d) => {
        d.watches.unshift(w);
      });
      logEvent({ type: "watch", amount: w.targetPrice, rule: "Kart Watch", reason: `Watching ${p.title} (now $${money(p.price)}) to buy at $${money(w.targetPrice)} or less.` });
      emit({ id: uid("ui_"), kind: "watch", watch: w });
      return { watching: true, current_price: p.price, target_price: w.targetPrice };
    }
  }
  return { error: "unknown tool" };
}

/** The bytes of the newest photo in the conversation (only that one is sent to Claude). */
async function latestPhoto(history: any[]): Promise<Buffer | null> {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const img = m.role === "user" && Array.isArray(m.content) ? m.content.find((b: any) => b.type === "kart_image") : null;
    if (img) return readUpload(img.path);
  }
  return null;
}

/** Convert stored history into API messages: only the latest photo is sent as an image. */
function toApiMessages(history: any[], photo: Buffer | null): Anthropic.MessageParam[] {
  let lastImgIdx = -1;
  history.forEach((m, i) => {
    if (m.role === "user" && Array.isArray(m.content) && m.content.some((b: any) => b.type === "kart_image")) lastImgIdx = i;
  });
  // Thinking blocks are tied to the system prompt they were made with. Kart's system prompt changes
  // between turns (spend so far, time), so drop thinking from earlier turns; keep it only for the
  // tool-use loop of the current turn (after the latest real user message).
  let lastUserIdx = -1;
  history.forEach((m, i) => {
    if (m.role === "user" && Array.isArray(m.content) && !m.content.some((b: any) => b.type === "tool_result")) lastUserIdx = i;
  });
  return history.map((m, i) => {
    if (m.role === "assistant" && Array.isArray(m.content) && i < lastUserIdx) {
      const kept = m.content.filter((b: any) => b.type !== "thinking" && b.type !== "redacted_thinking");
      return { role: "assistant", content: kept.length ? kept : [{ type: "text", text: "(ok)" }] };
    }
    if (m.role !== "user" || !Array.isArray(m.content)) return m;
    return {
      role: "user",
      content: m.content.map((b: any) => {
        if (b.type !== "kart_image") return b;
        if (i === lastImgIdx && photo) return { type: "image", source: { type: "base64", media_type: b.mediaType, data: photo.toString("base64") } };
        return { type: "text", text: "[photo attached earlier]" };
      }),
    };
  });
}

/** Keep history bounded without splitting tool_use/tool_result pairs. */
function trimHistory(h: any[]) {
  if (h.length <= 40) return h;
  let start = h.length - 40;
  while (start < h.length && !(h[start].role === "user" && Array.isArray(h[start].content) && h[start].content.some((b: any) => b.type === "text" || b.type === "kart_image") && !h[start].content.some((b: any) => b.type === "tool_result"))) start++;
  return h.slice(start);
}

export async function runAgent(opts: { chatId: string; text: string; image?: { path: string; mediaType: string; publicPath: string } | null; emit: Emit }) {
  const { chatId, emit } = opts;
  const chat = db().chats[chatId];
  if (!chat) throw new KartError("chat not found", 404);
  const persistEmit: Emit = (item) => {
    mutate((d) => {
      d.chats[chatId].ui.push(item);
    });
    emit(item);
  };

  // user turn
  const userItem: UIItem = { id: uid("ui_"), kind: "user", text: opts.text, image: opts.image?.publicPath || null };
  const notes = chat.notes;
  const content: any[] = [];
  if (notes.length) content.push({ type: "text", text: notes.map((n) => `<app_event>${n}</app_event>`).join("\n") });
  if (opts.image) content.push({ type: "kart_image", path: opts.image.path, mediaType: opts.image.mediaType });
  content.push({ type: "text", text: opts.text || "(photo)" });
  mutate((d) => {
    const c = d.chats[chatId];
    c.ui.push(userItem);
    c.notes = [];
    c.history.push({ role: "user", content });
    c.updatedAt = now();
    if (opts.image) c.lastImage = { path: opts.image.path, mediaType: opts.image.mediaType };
    if (c.title === "New chat" && opts.text) c.title = opts.text.slice(0, 48);
  });

  if (!hasAnthropic()) {
    persistEmit({ id: uid("ui_"), kind: "notice", tone: "warning", title: "Claude isn't set up", text: "Add ANTHROPIC_API_KEY to .env.local and restart Kart to start shopping." });
    return;
  }

  const client = anthropic();
  const system = systemPrompt(); // fixed for this turn, so thinking blocks stay valid inside the tool loop
  for (let turn = 0; turn < 8; turn++) {
    const c = db().chats[chatId];
    const hist = trimHistory(c.history as any[]);
    const params = { model: config.model, max_tokens: 1200, system, tools, messages: toApiMessages(hist, await latestPhoto(hist)) };
    let res: Anthropic.Message;
    if (thinkingOn()) {
      // Claude's reasoning is shown to the shopper in the chat's trace. Models differ in which thinking
      // setting they accept, so try each once and remember the one that works.
      res = await withThinking((extra) => client.messages.create({ ...params, max_tokens: 4000, ...extra } as Anthropic.MessageCreateParamsNonStreaming), () => client.messages.create(params));
    } else res = await client.messages.create(params);
    mutate((d) => {
      d.chats[chatId].history.push({ role: "assistant", content: res.content });
    });
    // Claude's own reasoning, shown in the trace like a "thinking" panel.
    for (const b of res.content) {
      if (b.type === "thinking" || b.type === "redacted_thinking") thinkingSeen++;
      if (b.type === "thinking" && (b as Anthropic.ThinkingBlock).thinking?.trim()) {
        const t = (b as Anthropic.ThinkingBlock).thinking.trim();
        persistEmit({ id: uid("ui_"), kind: "step", label: "Thinking", tool: "thinking", thought: true, detail: t.length > 600 ? t.slice(0, 599) + "…" : t });
      }
    }
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("\n")
      .trim();
    // Text Claude writes right before using tools is its plan ("I'll check your rules, then…"):
    // show it in the trace as its thinking, not as a chat bubble.
    if (text && res.stop_reason === "tool_use") persistEmit({ id: uid("ui_"), kind: "step", label: "Thinking", tool: "thinking", thought: true, detail: text.length > 600 ? text.slice(0, 599) + "…" : text });
    else if (text) persistEmit({ id: uid("ui_"), kind: "assistant", text });
    if (res.stop_reason !== "tool_use") break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const b of res.content) {
      if (b.type !== "tool_use") continue;
      persistEmit({ id: uid("ui_"), kind: "step", label: STEP_LABEL[b.name] || b.name, tool: b.name });
      const mark = eventMark();
      // Cards the tool shows (products, order, approval…) wait until its steps are shown, so the trace
      // reads in order: rules → live price → PayPal → store, then the order card.
      const held: UIItem[] = [];
      let out: unknown;
      try {
        out = await runTool(b.name, b.input, db().chats[chatId], (item) => held.push(item));
      } catch (e) {
        out = { error: (e as Error).message };
      }
      // Every real thing that happened during the tool (rules, live price, PayPal, store) as its own step.
      for (const st of stepsSince(mark, b.name)) persistEmit(st);
      for (const item of held) persistEmit(item);
      results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out) });
    }
    mutate((d) => {
      d.chats[chatId].history.push({ role: "user", content: results });
    });
  }
}

export function newChat(): Chat {
  const chat: Chat = { id: uid("c_"), title: "New chat", createdAt: now(), ui: [], history: [], notes: [], lastImage: null };
  mutate((d) => {
    d.chats[chat.id] = chat;
  });
  return chat;
}
