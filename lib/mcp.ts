/**
 * Kart MCP server: lets any AI agent (Claude Desktop, Claude.ai, ChatGPT, Cursor…) shop through Kart
 * for one shopper, always inside that shopper's spending rules.
 *
 * Transport: MCP "streamable HTTP" in stateless JSON mode (POST JSON-RPC, JSON response).
 * Safety: the agent can search and ask to buy. It can never approve a purchase above the shopper's
 * auto-buy limit (the shopper confirms in Kart), never exceed the max or monthly cap, and never sees PayPal details.
 */
import { config, money, now, uid } from "./config";
import { db, flushDb, logEvent, monthSpent, mutate } from "./db";
import { getProduct, searchProducts } from "./channel3";
import { decide, safetyChecks } from "./guard";
import { autoBuy, pushChatItem } from "./orders";
import { agentSpentThisMonth, permissions } from "./agentKeys";
import { HOUR, rateLimit } from "./rateLimit";
import type { AgentKey, Order, Product, UIItem } from "./types";

export const MCP_PROTOCOL = "2025-06-18";

const TOOLS = [
  {
    name: "search_products",
    title: "Search products",
    description: "Search thousands of real online stores (via Channel3) for products. Returns product_id, title, store, price, rating. Results are capped at the shopper's max price per item.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the shopper wants, e.g. 'wireless earbuds for the gym'" },
        max_price: { type: "number", description: "Optional max price in USD" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_my_rules",
    title: "Get spending rules",
    description: "The shopper's spending rules: what Kart may buy on its own, the most it may spend on one item, the monthly cap and how much is used, and whether PayPal is saved for one-tap payments.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "buy_product",
    title: "Buy within the shopper's rules",
    description:
      "Ask Kart to buy a product (use a product_id from search_products). Kart applies the shopper's rules: under the auto-buy limit it pays with the shopper's saved PayPal ('bought'); above it, it asks the shopper to confirm in Kart ('waiting_for_you', give them confirm_url); over the max or monthly cap it refuses ('blocked'). Never tell the shopper something is bought unless status is 'bought'.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        reason: { type: "string", description: "One short sentence: why this product, shown to the shopper" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "check_purchase",
    title: "Check a purchase request",
    description: "Check whether the shopper confirmed and paid a purchase that was 'waiting_for_you'.",
    inputSchema: { type: "object", properties: { request_id: { type: "string" } }, required: ["request_id"] },
  },
  {
    name: "list_orders",
    title: "List orders",
    description: "The shopper's recent Kart orders with status, store, price, tracking and any money paid back under the Kart Guarantee.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  },
];

const INSTRUCTIONS =
  "Kart lets you shop for this person with their PayPal, but only inside the spending rules they set. " +
  "Search with search_products, then call buy_product. If buy_product returns 'waiting_for_you', tell them to confirm at confirm_url and later call check_purchase. " +
  "If it returns 'blocked', explain the rule; don't try to get around it. Never say an item is bought unless the status is 'bought' or 'paid'.";

const credited = (o: Order) => (o.credits || []).reduce((s, c) => s + c.amount, 0);
const orderView = (o: Order) => ({
  order_id: o.id,
  title: o.title,
  store: o.store,
  price: o.price,
  status: o.status,
  paid_at: o.paidAt,
  tracking: o.trackingNumber ? `${o.carrier || "USPS"} ${o.trackingNumber}` : null,
  paid_back: credited(o) || undefined,
  paypal_transaction: o.paypalCaptureId,
  view_in_kart: `${config.appUrl}/orders/${o.id}`,
});
const productView = (p: Product) => ({ product_id: p.id, title: p.title, brand: p.brand, store: p.store, price: p.price, stores_selling_it: p.offers?.length || 1, rating: p.rating ?? undefined, reviews: p.reviews ?? undefined, features: p.features?.slice(0, 4) });

/** A chat in the shopper's Kart where the agent's request shows up (so they can see and confirm it). */
function agentChat(agent: AgentKey, p: Product, text: string) {
  const id = uid("c_");
  mutate((d) => {
    d.chats[id] = { id, title: p.title.slice(0, 80), agent: agent.label, agentKeyId: agent.id, createdAt: now(), updatedAt: now(), ui: [], history: [], notes: [], lastImage: null };
  });
  pushChatItem(id, { id: uid("ui_"), kind: "assistant", text });
  return id;
}

async function callTool(agent: AgentKey, name: string, args: Record<string, unknown>) {
  const rules = db().rules;
  switch (name) {
    case "search_products": {
      const cap = rules.perItemMax;
      const max = Number(args.max_price) > 0 ? Math.min(Number(args.max_price), cap) : cap;
      const q = String(args.query || "").slice(0, 200).trim();
      if (!q) return { status: "error", message: "Give a search query." };
      const r = await searchProducts(q, max);
      logEvent({ type: "search", reason: `${agent.label} searched "${args.query}" under $${max}: ${r.products.length} results.` });
      return { count: r.products.length, max_price_applied: max, products: r.products.slice(0, 8).map(productView) };
    }
    case "get_my_rules": {
      const spent = monthSpent();
      const perm = permissions(agent);
      return {
        this_agent: {
          can_buy: perm.canBuy,
          can_pay_on_its_own: perm.canBuy && perm.canAutoBuy,
          monthly_budget: perm.monthlyBudget,
          spent_this_month: agentSpentThisMonth(agent.id),
          key_expires: perm.expiresAt,
        },
        buys_on_its_own_up_to: rules.autoBuyUnder,
        asks_first_up_to: rules.perItemMax,
        never_spends_over: rules.perItemMax,
        monthly_cap: rules.monthlyCap,
        spent_this_month: spent,
        left_this_month: Math.max(0, Math.round((rules.monthlyCap - spent) * 100) / 100),
        max_orders_per_hour: rules.maxOrdersPerHour ?? 5,
        paypal_saved_for_one_tap: rules.mandateActive,
      };
    }
    case "buy_product": {
      const perm = permissions(agent);
      if (!perm.canBuy) return { status: "not_allowed", message: "This agent can search and read orders but isn't allowed to buy. The shopper can change that in Kart under Connected agents." };
      rateLimit(`mcp:buy:${agent.id}`, 15, HOUR, "This agent has asked to buy too many times this hour. Try again later.");
      const p = getProduct(String(args.product_id || ""));
      if (!p) return { status: "error", message: "Unknown product_id. Call search_products first and use one of its product_ids." };
      // The agent's own monthly budget, on top of the shopper's rules.
      const agentSpent = agentSpentThisMonth(agent.id);
      if (agentSpent + p.price > perm.monthlyBudget) {
        const rule = `${agent.label} budget $${money(perm.monthlyBudget)}/month`;
        const reason = `$${money(p.price)} would take ${agent.label} over its $${money(perm.monthlyBudget)} monthly budget ($${money(agentSpent)} already spent).`;
        logEvent({ type: "blocked", amount: p.price, rule, reason: `${agent.label} asked to buy ${p.title}. Blocked: ${reason}` });
        return { status: "blocked", rule, reason, message: "Kart refused this purchase: it's over this agent's monthly budget. No money moved." };
      }
      const g = decide(p.price);
      const why = args.reason ? ` Reason: ${String(args.reason).slice(0, 200)}` : "";
      if (g.decision === "blocked") {
        logEvent({ type: "blocked", amount: p.price, rule: g.rule, reason: `${agent.label} asked to buy ${p.title} for $${money(p.price)}. Blocked: ${g.reason}` });
        return { status: "blocked", rule: g.rule, reason: g.reason, message: "Kart refused this purchase because of the shopper's rules. No money moved." };
      }
      const safety = safetyChecks(p.id, p.store);
      if (safety.blocks.length) {
        logEvent({ type: "blocked", amount: p.price, rule: "Safety limit", reason: `${agent.label}: ${safety.blocks[0]}` });
        return { status: "blocked", rule: "Safety limit", reason: safety.blocks[0] };
      }
      logEvent({ type: "decision", amount: p.price, rule: g.rule, reason: `${agent.label} asked to buy ${p.title} ($${money(p.price)}) from ${p.store}.${why} ${g.reason}` });

      // Under the auto-buy limit, with PayPal saved: pay now.
      if (g.decision === "auto" && perm.canAutoBuy && rules.mandateActive && safety.warnings.length === 0) {
        try {
          const chatId = agentChat(agent, p, `${agent.label} bought ${p.title} for you, inside your $${rules.autoBuyUnder} auto-buy limit.${why}`);
          const order = await autoBuy(p.id, chatId);
          pushChatItem(chatId, { id: uid("ui_"), kind: "order", order, auto: true });
          return { status: "bought", order: orderView(order), message: `Paid $${money(p.price)} with the shopper's saved PayPal. They can cancel within 10 minutes in Kart. Covered by the Kart Guarantee.` };
        } catch (e) {
          console.warn("[mcp] auto-buy failed, asking the shopper instead:", (e as Error).message);
        }
      }

      // Otherwise: the shopper confirms in Kart.
      const itemId = uid("ui_");
      const chatId = agentChat(
        agent,
        p,
        `${agent.label} wants to buy ${p.title} for $${money(p.price)} from ${p.store}.${why} ${g.decision === "auto" ? (perm.canAutoBuy ? "Confirm once to pay with PayPal." : `${agent.label} isn't allowed to pay on its own, so it needs your OK.`) : `It's over your $${rules.autoBuyUnder} auto-buy limit, so it needs your OK.`}${safety.warnings.length ? ` Note: ${safety.warnings.join(" ")}` : ""}`,
      );
      const fresh = getProduct(p.id) || p; // the live price check may have found a cheaper store
      const item: UIItem = { id: itemId, kind: "approval", product: fresh, decision: decide(fresh.price).decision === "auto" ? "auto" : "needs_approval", rule: g.rule, state: "pending" };
      pushChatItem(chatId, item);
      const confirm_url = `${config.appUrl}/chat/${chatId}`;
      return {
        status: "waiting_for_you",
        request_id: `${chatId}:${itemId}`,
        confirm_url,
        amount: p.price,
        rule: g.rule,
        message: `Not paid yet. The shopper needs to confirm $${money(p.price)} in Kart: ${confirm_url}. Then call check_purchase with the request_id.`,
      };
    }
    case "check_purchase": {
      const [chatId, itemId] = String(args.request_id || "").split(":");
      const chat = chatId ? db().chats[chatId] : null;
      const item = chat?.ui.find((i) => i.id === itemId);
      if (!chat || !item || item.kind !== "approval") return { status: "error", message: "Unknown request_id." };
      if (item.state === "paid") {
        const order = db().orders.find((o) => o.id === item.orderId);
        return { status: "paid", order: order ? orderView(order) : { order_id: item.orderId }, message: "The shopper confirmed and paid with PayPal." };
      }
      return { status: "waiting_for_you", confirm_url: `${config.appUrl}/chat/${chatId}`, message: "Still waiting for the shopper to confirm in Kart." };
    }
    case "list_orders": {
      const n = Math.min(20, Math.max(1, Number(args.limit) || 10));
      return { orders: db().orders.filter((o) => o.status !== "created").slice(0, n).map(orderView) };
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${name}`);
  }
}

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, any> };

/** Handle one JSON-RPC message. Returns null for notifications. Runs inside asTenant(agent.tenant). */
export async function handleRpc(agent: AgentKey, msg: Rpc): Promise<object | null> {
  if (!msg || typeof msg !== "object" || typeof msg.method !== "string") return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } };
  const isNote = msg.id === undefined || msg.id === null;
  try {
    let result: unknown;
    switch (msg.method) {
      case "initialize":
        result = {
          protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : MCP_PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "kart", title: "Kart: shop within your rules", version: "1.0.0" },
          instructions: INSTRUCTIONS,
        };
        break;
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call": {
        const name = String(msg.params?.name || "");
        if (!TOOLS.some((t) => t.name === name)) throw new RpcError(-32602, `Unknown tool: ${name}`);
        try {
          const out = await callTool(agent, name, (msg.params?.arguments || {}) as Record<string, unknown>);
          await flushDb();
          result = { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out, isError: (out as { status?: string }).status === "error" };
        } catch (e) {
          if (e instanceof RpcError) throw e;
          result = { content: [{ type: "text", text: `Kart couldn't do that: ${(e as Error).message}` }], isError: true };
        }
        break;
      }
      default:
        if (isNote) return null; // notifications/initialized etc.
        throw new RpcError(-32601, `Method not found: ${msg.method}`);
    }
    return isNote ? null : { jsonrpc: "2.0", id: msg.id, result };
  } catch (e) {
    if (isNote) return null;
    const code = e instanceof RpcError ? e.code : -32603;
    return { jsonrpc: "2.0", id: msg.id, error: { code, message: (e as Error).message } };
  }
}
