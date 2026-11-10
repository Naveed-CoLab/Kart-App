import { putUpload } from "./files";
import { placeStoreOrder } from "./storeCheckout";
/**
 * Kart money operations (Kart Guarantee model).
 *  1. The shopper's PayPal pays the store right away (direct payee, or Kart pays the store instantly via Payouts).
 *  2. If something goes wrong, Kart pays the shopper back immediately (Kart Guarantee) and recovers from the store later.
 * Every function re-checks state server-side before calling PayPal.
 */
import { config, money, now, round2, uid } from "./config";
import { payeeFor as storePayeeFor } from "./stores";
import { currentActor, currentActorId, db, getOrder, logEvent, mutate, updateOrder } from "./db";
import { Channel3Error, currentPrice, getProduct, liveProduct } from "./channel3";
import { consumeApprovalToken, decide, safetyChecks } from "./guard";
import { captureOrder, chargeVault, createOrder, createPayout } from "./paypal";
import { addShipmentTracking, refund, updateShipmentDelivered } from "./toolkit";
import { scoreClaim } from "./fraud";
import { inspectDamagePhoto } from "./vision";
import type { Claim, GuaranteeCredit, Order, UIItem } from "./types";
import { eventMark, stepsSince } from "./trace";

export class KartError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ---------- chat helpers ----------
export function pushChatItem(chatId: string | null | undefined, item: UIItem) {
  if (!chatId) return;
  mutate((d) => {
    const c = d.chats[chatId];
    if (c) {
      c.ui.push(item);
      c.updatedAt = now();
    }
  });
}
export function addChatNote(chatId: string | null | undefined, note: string) {
  if (!chatId) return;
  mutate((d) => {
    const c = d.chats[chatId];
    if (c) c.notes.push(note);
  });
}
function replaceChatItem(chatId: string | null | undefined, itemId: string, fn: (i: UIItem) => UIItem) {
  if (!chatId) return;
  mutate((d) => {
    const c = d.chats[chatId];
    if (!c) return;
    c.ui = c.ui.map((i) => (i.id === itemId ? fn(i) : i));
  });
}

export const credited = (o: Order) => round2((o.credits || []).reduce((s, c) => s + c.amount, 0));
export const netPaid = (o: Order) => round2(o.price - credited(o));
const fee = (amount: number) => round2(amount * config.feeRate);
const storePayee = (store: string) => storePayeeFor(store);

function newOrder(productId: string, chatId: string | null | undefined, buyMode: Order["buyMode"]): Order {
  const p = getProduct(productId);
  if (!p) throw new KartError("Unknown product", 404);
  return {
    id: uid("ord_"),
    chatId: chatId || null,
    productId,
    title: p.title,
    store: p.store,
    image: p.image,
    price: p.price,
    merchant: "store",
    payee: storePayee(p.store),
    status: "created",
    buyMode,
    agent: currentActor() || (chatId ? db().chats[chatId]?.agent : null) || "Kart chat",
    agentKeyId: currentActorId() || (chatId ? db().chats[chatId]?.agentKeyId : null) || null,
    storesCompared: p.offers?.length || 1,
    highestStorePrice: p.offers?.length ? p.offers[p.offers.length - 1].price : p.price,
    credits: [],
    createdAt: now(),
  };
}

/** After capture: if Kart received the money (fallback), pay the store immediately so the store is never kept waiting. */
async function settleStore(o: Order): Promise<Partial<Order>> {
  const f = fee(o.price);
  if (o.merchant === "store") {
    logEvent({ type: "store_paid", orderId: o.id, amount: o.price, rule: "Paid directly", reason: `${o.store} received $${money(o.price)} straight from your PayPal. Kart never held the money. (Kart fee $${money(f)} is invoiced to the store.)` });
    return { fee: f };
  }
  const receiver = o.payee || config.storeEmail;
  if (!receiver) {
    logEvent({ type: "store_paid", orderId: o.id, amount: o.price, rule: "Store payment pending", reason: `Set STORE_PAYPAL_EMAIL so Kart can pay ${o.store} instantly.` });
    return { fee: f };
  }
  const r = await createPayout({ ref: `store-${o.id}`, amount: round2(o.price - f), receiver, note: `Kart order ${o.id}: ${o.title}. $${money(o.price)} − $${money(f)} Kart fee.`, subject: "New Kart order: you've been paid" });
  logEvent({ type: "store_paid", orderId: o.id, amount: round2(o.price - f), rule: "Paid instantly via Payouts", reason: `Paid ${o.store} $${money(o.price - f)} right away with PayPal Payouts ($${money(o.price)} − $${money(f)} Kart fee). Batch ${r.batchId}.`, ref: r.batchId });
  return { fee: f, storePayoutBatchId: r.batchId };
}

// ---------- live price check (Channel3) ----------
/**
 * Right before PayPal charges, check the product again on Channel3: the price an agent saw minutes ago
 * may have changed, or the store may be out of stock. Kart then buys from the cheapest store that has it now.
 * Price went up → stop and ask again. Price went down → the shopper pays less. Nowhere in stock → stop.
 * If Channel3 can't be reached, Kart keeps the price the shopper saw.
 */
export async function liveRecheck(productId: string) {
  const before = getProduct(productId);
  if (!before) throw new KartError("Unknown product", 404);
  let live;
  try {
    live = await liveProduct(productId);
  } catch (e) {
    if (e instanceof Channel3Error && /isn't set up/.test(e.message)) return before;
    console.warn("[kart] live price check failed, using the price the shopper saw:", (e as Error).message);
    return before;
  }
  if (!live) {
    logEvent({ type: "blocked", amount: before.price, rule: "Live check", reason: `Checked ${before.title} on Channel3 just before paying: no store has it in stock now. Nothing was charged.` });
    throw new KartError(`${before.title} just went out of stock everywhere Channel3 checked. Nothing was charged.`, 409);
  }
  const stores = live.offers?.length || 1;
  const switched = live.store !== before.store;
  if (live.price > before.price + 0.009) {
    logEvent({ type: "blocked", amount: live.price, rule: "Live check", reason: `Price went up from $${money(before.price)} to $${money(live.price)} (${live.store}) since you saw it. Kart stopped so you can decide again. Nothing was charged.` });
    throw new KartError(`The price just changed from $${money(before.price)} to $${money(live.price)}. Nothing was charged. Ask me to buy it again at the new price if you still want it.`, 409);
  }
  const saved = round2(before.price - live.price);
  logEvent({
    type: "decision",
    amount: live.price,
    rule: "Live check",
    reason:
      `Checked live on Channel3 just before paying: $${money(live.price)} at ${live.store}, the cheapest of ${stores} store${stores > 1 ? "s" : ""} with it in stock.` +
      (saved > 0 ? ` That's $${money(saved)} less than when you saw it${switched ? ` (${before.store} changed, so Kart switched store)` : ""}.` : switched ? ` ${before.store} no longer had the best price, so Kart switched store.` : ""),
  });
  return live;
}

// ---------- buying ----------
export async function startCheckout(opts: { productId: string; chatId?: string; token?: string; saveMandate?: boolean; fundingSource?: string }) {
  const p = getProduct(opts.productId);
  if (!p) throw new KartError("Unknown product", 404);
  const g = decide(p.price);
  if (g.decision === "blocked") {
    logEvent({ type: "blocked", amount: p.price, rule: g.rule, reason: g.reason });
    throw new KartError(g.reason, 403);
  }
  if (g.decision === "needs_approval") {
    const err = consumeApprovalToken(opts.token, p.id, p.price);
    if (err) {
      logEvent({ type: "blocked", amount: p.price, rule: g.rule, reason: `Checkout refused: ${err}` });
      throw new KartError(err, 403);
    }
    logEvent({ type: "approval", amount: p.price, rule: g.rule, reason: `You approved $${money(p.price)} for ${p.title}.` });
  }
  const live = await liveRecheck(p.id);
  if (decide(live.price).decision === "blocked") throw new KartError(decide(live.price).reason, 403);
  const order = newOrder(p.id, opts.chatId, "popup");
  order.fundingSource = opts.fundingSource || "paypal";
  const save = !!opts.saveMandate && !db().rules.mandateActive && (opts.fundingSource || "paypal") === "paypal";
  const pp = await createOrder({ ref: order.id, amount: live.price, description: `${live.title} (${live.store}) via Kart`, payee: order.payee, saveToVault: save });
  order.paypalOrderId = pp.id;
  order.merchant = pp.merchant;
  mutate((d) => {
    d.orders.unshift(order);
  });
  return { paypalOrderId: pp.id, orderId: order.id, vaultRequested: pp.vaultRequested };
}

export async function completeCheckout(opts: { paypalOrderId: string; chatId?: string; itemId?: string }) {
  const mark = eventMark();
  const order = db().orders.find((o) => o.paypalOrderId === opts.paypalOrderId);
  if (!order) throw new KartError("Order not found", 404);
  if (order.status !== "created") return order;
  const cap = await captureOrder(opts.paypalOrderId);
  if (cap.status !== "COMPLETED" && cap.status !== "PENDING") throw new KartError(`Capture status ${cap.status}`, 402);
  const payerEmail = cap.payerEmail || db().rules.payerEmail || config.shopperEmail || null;
  let updated = updateOrder(order.id, { paypalCaptureId: cap.captureId, payerEmail, status: "paid", paidAt: now() });
  logEvent({
    type: "payment",
    orderId: order.id,
    amount: order.price,
    rule: order.merchant === "store" ? "Paid to store" : "Paid via Kart",
    reason: `Paid $${money(order.price)} with PayPal${order.fundingSource === "paylater" ? " Pay Later" : ""}. Covered by Kart Guarantee.`,
    ref: cap.captureId,
  });
  updated = updateOrder(order.id, await settleStore(updated));
  updated = updateOrder(order.id, { storeOrder: placeStoreOrder(updated, cap.shipTo || db().rules.shipTo) });
  mutate((d) => {
    if (payerEmail) d.rules.payerEmail = payerEmail;
    if (cap.payerName) d.rules.payerName = cap.payerName;
    if (cap.shipTo) d.rules.shipTo = cap.shipTo;
    if (cap.vaultId) {
      d.rules.vaultId = cap.vaultId;
      d.rules.paypalCustomerId = cap.customerId || null;
      d.rules.mandateActive = true;
    }
  });
  if (cap.vaultId) logEvent({ type: "rules", rule: "Agent Mandate", reason: `PayPal saved in PayPal's vault. Kart may now buy up to $${db().rules.autoBuyUnder} for you without a popup.` });
  const chatId = opts.chatId || order.chatId;
  if (opts.itemId) replaceChatItem(chatId, opts.itemId, (i) => (i.kind === "approval" ? { ...i, state: "paid", orderId: order.id } : i));
  for (const st of stepsSince(mark, "checkout")) pushChatItem(chatId, st);
  pushChatItem(chatId, { id: uid("ui_"), kind: "order", order: updated });
  addChatNote(chatId, `Payment captured for order ${order.id} (${order.title}, $${money(order.price)}); ${order.store} has been paid. Kart Guarantee is active.${cap.vaultId ? " Agent Mandate is now on." : ""}`);
  return { ...updated, mandateSaved: !!cap.vaultId };
}

/** Charge the saved PayPal (vault) with no popup. Used by auto-buy and by one-tap confirmed orders. */
async function chargeSaved(productId: string, chatId: string | null | undefined, mode: "auto" | "confirmed", rule: string, reason: string) {
  if (!getProduct(productId)) throw new KartError("Unknown product", 404);
  const p = await liveRecheck(productId);
  const g = decide(p.price);
  if (g.decision === "blocked") throw new KartError(g.reason, 403);
  if (mode === "auto" && g.decision !== "auto") throw new KartError("This now needs your OK.", 409);
  const rules = db().rules;
  if (!rules.mandateActive || !rules.vaultId) throw new KartError("Connect PayPal first: pay once with PayPal and keep “Save PayPal” on.", 403);
  const safety = safetyChecks(p.id, p.store);
  if (safety.blocks.length) {
    logEvent({ type: "blocked", amount: p.price, rule: "Safety limit", reason: safety.blocks[0] });
    throw new KartError(safety.blocks[0], 429);
  }
  const order = newOrder(p.id, chatId, mode);
  order.fundingSource = "paypal_vault";
  mutate((d) => {
    d.orders.unshift(order);
  });
  try {
    const cap = await chargeVault({ ref: order.id, amount: p.price, description: `${p.title} (${p.store}) via Kart`, vaultId: rules.vaultId, payee: order.payee });
    let updated = updateOrder(order.id, { merchant: cap.merchant, paypalOrderId: cap.paypalOrderId, paypalCaptureId: cap.captureId, payerEmail: rules.payerEmail || config.shopperEmail || null, status: "paid", paidAt: now() });
    logEvent({ type: mode === "auto" ? "auto_buy" : "payment", orderId: order.id, amount: p.price, rule, reason: `${mode === "auto" ? "Bought" : "You confirmed and Kart bought"} ${p.title} for $${money(p.price)} with your saved PayPal. ${reason}`, ref: cap.captureId });
    if (cap.shipTo) mutate((d) => void (d.rules.shipTo = cap.shipTo));
    updated = updateOrder(order.id, await settleStore(updated));
    updated = updateOrder(order.id, { storeOrder: placeStoreOrder(updated, db().rules.shipTo) });
    return updated;
  } catch (e) {
    mutate((d) => {
      d.orders = d.orders.filter((o) => o.id !== order.id);
    });
    throw e;
  }
}

/** Agent Mandate auto-buy: only in the auto tier (amount ≤ auto-buy limit). */
export async function autoBuy(productId: string, chatId?: string | null) {
  const p = getProduct(productId);
  if (!p) throw new KartError("Unknown product", 404);
  const g = decide(p.price);
  if (g.decision !== "auto") throw new KartError(`Auto-buy refused: ${g.reason}`, 403);
  return chargeSaved(productId, chatId, "auto", g.rule, g.reason);
}

/**
 * Muse-style one-tap order: the shopper taps "Confirm & pay" on the card and Kart pays with the saved PayPal.
 * Safety: signed single-use confirmation bound to product + exact price, live price re-check, spending rules, velocity limit.
 */
export async function confirmOrder(opts: { productId: string; token: string; chatId?: string | null; itemId?: string }) {
  const mark = eventMark();
  const p = getProduct(opts.productId);
  if (!p) throw new KartError("Unknown product", 404);
  const g = decide(p.price);
  if (g.decision === "blocked") throw new KartError(g.reason, 403);
  const err = consumeApprovalToken(opts.token, p.id, p.price);
  if (err) {
    logEvent({ type: "blocked", amount: p.price, rule: "Confirmation", reason: `Order refused: ${err}` });
    throw new KartError(err, 403);
  }
  // Price lock: never charge more than what the shopper saw.
  try {
    const live = await currentPrice(p.id);
    if (live > p.price + 0.009) {
      logEvent({ type: "blocked", amount: live, rule: "Price lock", reason: `${p.title} went up from $${money(p.price)} to $${money(live)}; Kart didn't charge you.` });
      throw new KartError(`The price changed to $${money(live)}. Please confirm the new price.`, 409);
    }
  } catch (e) {
    if (e instanceof KartError) throw e;
    console.warn("[confirm] live price check skipped:", (e as Error).message);
  }
  logEvent({ type: "approval", amount: p.price, rule: g.rule, reason: `You confirmed $${money(p.price)} for ${p.title}.` });
  const order = await chargeSaved(p.id, opts.chatId, "confirmed", "Confirmed by you", "");
  const chatId = opts.chatId || order.chatId;
  if (opts.itemId) replaceChatItem(chatId, opts.itemId, (i) => (i.kind === "approval" ? { ...i, state: "paid", orderId: order.id } : i));
  for (const st of stepsSince(mark, "confirm")) pushChatItem(chatId, st);
  pushChatItem(chatId, { id: uid("ui_"), kind: "order", order });
  addChatNote(chatId, `The shopper confirmed and Kart paid for order ${order.id} (${order.title}, $${money(order.price)}) with the saved PayPal, and placed it on ${order.store}${order.storeOrder ? ` (store order #${order.storeOrder.number}${order.storeOrder.mode === "demo" ? ", sandbox demo" : ""})` : ""}.`);
  return order;
}

// ---------- delivery ----------
/** Store-side: the store ships the order and enters its real tracking number. */
export async function markShipped(orderId: string, trackingNumber: string, carrier = "USPS") {
  const o = getOrder(orderId);
  if (!o) throw new KartError("Order not found", 404);
  if (o.status !== "paid") throw new KartError(`Can't ship from status ${o.status}`);
  const tracking = String(trackingNumber || "").trim();
  if (!/^[A-Za-z0-9-]{6,40}$/.test(tracking)) throw new KartError("Enter a valid tracking number");
  const t = o.paypalCaptureId ? await addShipmentTracking(o.paypalCaptureId, tracking, carrier) : { via: "none" };
  const updated = updateOrder(orderId, { status: "shipped", trackingNumber: tracking, carrier, shippedAt: now() });
  logEvent({
    type: "shipment",
    orderId,
    rule: "Tracking",
    reason: `${o.store} shipped it (${carrier} ${tracking}). ${t.via === "agent-toolkit" ? "Tracking added to the PayPal transaction via Agent Toolkit." : "Tracking saved in Kart."}`,
    ref: tracking,
  });
  pushChatItem(o.chatId, { id: uid("ui_"), kind: "notice", tone: "info", title: "Shipped", text: `${o.title} is on the way · ${carrier} ${tracking}.`, orderId });
  return updated;
}

/** Shopper-side: confirm the order arrived. */
export async function markDelivered(orderId: string) {
  const o = getOrder(orderId);
  if (!o) throw new KartError("Order not found", 404);
  if (o.status !== "shipped" && o.status !== "paid") throw new KartError(`Can't deliver from status ${o.status}`);
  if (o.paypalCaptureId && o.trackingNumber) await updateShipmentDelivered(o.paypalCaptureId, o.trackingNumber);
  const updated = updateOrder(orderId, { status: "delivered", deliveredAt: now(), shippedAt: o.shippedAt || now() });
  logEvent({ type: "delivery", orderId, rule: "Delivered", reason: `You confirmed it arrived. Kart Guarantee covers damage for 30 days; just send a photo.` });
  pushChatItem(o.chatId, { id: uid("ui_"), kind: "notice", tone: "info", title: "Delivered", text: `${o.title} arrived. If anything's wrong, send me a photo and I'll pay you back right away.`, orderId });
  addChatNote(o.chatId, `Order ${orderId} was delivered.`);
  return updated;
}

// ---------- Kart Guarantee ----------
const KIND_LABEL: Record<GuaranteeCredit["kind"], string> = { claim: "Damage claim", price_drop: "Price Guard", undo: "Undo auto-buy", lost: "Lost package" };

/** Pay the shopper back right away. Kart refunds its own capture when it was the merchant; otherwise it pays from its balance via Payouts. */
export async function guaranteeCredit(orderId: string, opts: { amount?: number; kind: GuaranteeCredit["kind"]; reason: string }) {
  const o = getOrder(orderId);
  if (!o) throw new KartError("Order not found", 404);
  if (o.status === "refunded") throw new KartError("Already refunded in full");
  const remaining = netPaid(o);
  const amount = round2(Math.min(opts.amount ?? remaining, remaining));
  if (amount <= 0) throw new KartError("Nothing left to refund");
  let via: GuaranteeCredit["via"];
  let ref: string;
  let channel: string;
  if (o.merchant === "kart" && o.paypalCaptureId) {
    const r = await refund(o.paypalCaptureId, amount, opts.reason);
    via = "refund";
    ref = r.id;
    channel = r.via === "agent-toolkit" ? "PayPal refund (Agent Toolkit)" : "PayPal refund";
  } else {
    const receiver = o.payerEmail || db().rules.payerEmail || config.shopperEmail;
    if (!receiver) throw new KartError("No shopper PayPal email on file (set SHOPPER_PAYPAL_EMAIL)", 400);
    const r = await createPayout({ ref: `kg-${o.id}-${opts.kind}`, amount, receiver, note: `Kart Guarantee: ${opts.reason}`, subject: "Kart Guarantee: money back" });
    via = "payout";
    ref = r.batchId;
    channel = "PayPal Payouts";
  }
  const credit: GuaranteeCredit = { id: uid("kg_"), kind: opts.kind, amount, via, ref, at: now(), recovered: false };
  const full = amount >= remaining;
  const updated = updateOrder(orderId, { credits: [...(o.credits || []), credit], ...(full ? { status: "refunded" as const, refundedAt: now() } : {}) });
  logEvent({
    type: opts.kind === "price_drop" ? "price_drop" : "guarantee",
    orderId,
    amount,
    rule: `Kart Guarantee · ${KIND_LABEL[opts.kind]}`,
    reason: `${opts.reason} Kart paid you $${money(amount)} instantly via ${channel} (${ref}). Kart recovers it from ${o.store}; you don't have to.`,
    ref,
  });
  return { order: updated, credit };
}

/** Store-side: the store settles the return / adjustment with Kart. */
export async function recoverFromStore(orderId: string) {
  const o = getOrder(orderId);
  if (!o) throw new KartError("Order not found", 404);
  const open = (o.credits || []).filter((c) => !c.recovered);
  if (!open.length) throw new KartError("Nothing to recover");
  const amount = round2(open.reduce((s, c) => s + c.amount, 0));
  const updated = updateOrder(orderId, { credits: o.credits.map((c) => ({ ...c, recovered: true })) });
  logEvent({ type: "recovery", orderId, amount, rule: "Recovered from store", reason: `${o.store} settled $${money(amount)} with Kart for this order.` });
  return updated;
}

export async function undoAutoBuy(orderId: string) {
  const mark = eventMark();
  const o = getOrder(orderId);
  if (!o) throw new KartError("Order not found", 404);
  if (o.buyMode === "popup") throw new KartError("Only orders paid with your saved PayPal can be undone here");
  if (Date.now() - new Date(o.paidAt || o.createdAt).getTime() > 10 * 60_000) throw new KartError("The 10-minute undo window has passed");
  if (o.status !== "paid") throw new KartError("Already shipped; report a problem instead");
  const r = await guaranteeCredit(orderId, { kind: "undo", reason: "You cancelled within 10 minutes; Kart cancels the order with the store." });
  for (const st of stepsSince(mark, "undo")) pushChatItem(o.chatId, st);
  pushChatItem(o.chatId, { id: uid("ui_"), kind: "notice", tone: "success", title: "Order cancelled", text: `$${money(o.price)} is back in your PayPal.`, orderId });
  return r;
}

/** Price Guard: re-price the product on Channel3; if it's cheaper than what you paid, Kart pays the difference. */
export async function priceCheck(orderId: string) {
  const o = getOrder(orderId);
  if (!o) throw new KartError("Order not found", 404);
  if (!["paid", "shipped", "delivered"].includes(o.status)) throw new KartError(`Price Guard doesn't apply (status: ${o.status})`);
  if (Date.now() - new Date(o.paidAt || o.createdAt).getTime() > 30 * 86400000) throw new KartError("Outside the 30-day Price Guard window");
  const current = await currentPrice(o.productId);
  const paidNet = netPaid(o);
  const diff = round2(paidNet - current);
  updateOrder(orderId, { lastPriceCheck: { price: current, at: now() } });
  if (diff <= 0) return { changed: false, price: current, diff: 0 };
  const r = await guaranteeCredit(orderId, { amount: diff, kind: "price_drop", reason: `Price dropped from $${money(paidNet)} to $${money(current)} at ${o.store}.` });
  pushChatItem(o.chatId, { id: uid("ui_"), kind: "notice", tone: "success", title: "Price Guard", text: `${o.title} dropped to $${money(current)}. I sent you the $${money(diff)} difference.`, orderId });
  addChatNote(o.chatId, `Price Guard paid the shopper $${money(diff)} on order ${orderId}.`);
  return { changed: true, price: current, diff, ...r };
}

/** Shopper-side: the package never arrived. */
export async function reportNotReceived(orderId: string) {
  const o = getOrder(orderId);
  if (!o) throw new KartError("Order not found", 404);
  if (o.status !== "shipped") throw new KartError("You can report a missing package once it has shipped");
  return guaranteeCredit(orderId, { kind: "lost", reason: "You reported the package never arrived." });
}

// ---------- claims ----------
export async function saveUpload(dataUrl: string): Promise<{ path: string; mediaType: string; publicPath: string }> {
  const m = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/);
  if (!m) throw new KartError("Unsupported image");
  const mediaType = m[1] === "image/jpg" ? "image/jpeg" : m[1];
  const ext = mediaType.split("/")[1];
  const bytes = Buffer.from(m[3], "base64");
  if (bytes.length > 6 * 1024 * 1024) throw new KartError("That photo is too large. Try one under 6 MB.", 413);
  // The bytes must really be the image type they claim to be.
  const magic: Record<string, (b: Buffer) => boolean> = {
    "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    "image/gif": (b) => b.subarray(0, 4).toString("ascii") === "GIF8",
    "image/webp": (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  };
  if (!magic[mediaType]?.(bytes)) throw new KartError("That file isn't a valid image.", 415);
  const name = uid("img_") + "." + ext;
  const p = await putUpload(name, mediaType, bytes);
  return { path: p, mediaType, publicPath: `/api/uploads/${name}` };
}

export async function fileClaim(opts: { orderId: string; reason: string; imagePath: string; mediaType: string; chatId?: string | null }) {
  const o = getOrder(opts.orderId);
  if (!o) throw new KartError("Order not found", 404);
  if (!["paid", "shipped", "delivered"].includes(o.status)) throw new KartError(`Can't claim on status ${o.status}`);
  const p = getProduct(o.productId);
  const vision = await inspectDamagePhoto({ imagePath: opts.imagePath, mediaType: opts.mediaType, productTitle: o.title, productImage: p?.image, reason: opts.reason });
  const days = o.deliveredAt ? (Date.now() - new Date(o.deliveredAt).getTime()) / 86400000 : 0;
  const previous = db().claims.filter((c) => c.orderId !== o.id).length;
  const s = scoreClaim({ vision, daysSinceDelivery: days, previousClaims: previous });
  const claim: Claim = { id: uid("clm_"), orderId: o.id, reason: opts.reason, imagePath: opts.imagePath, vision, riskScore: s.score, reasons: s.reasons, decision: s.decision, createdAt: now() };
  logEvent({ type: "claim", orderId: o.id, amount: o.price, rule: `Risk ${s.score.toFixed(2)} vs 0.30`, reason: `Claude vision: ${vision.summary}` });
  let order = o;
  if (s.decision === "auto_refund") {
    const r = await guaranteeCredit(o.id, { kind: "claim", reason: `Damage claim approved (risk ${s.score.toFixed(2)} < 0.30).` });
    claim.refundId = r.credit.ref;
    order = r.order;
  } else {
    order = updateOrder(o.id, { status: "claim_review" });
  }
  mutate((d) => {
    d.claims.unshift(claim);
  });
  return { claim, order };
}

/** Store/Kart reviewer approves a high-risk claim. */
export async function approveClaim(orderId: string) {
  const o = getOrder(orderId);
  if (!o || o.status !== "claim_review") throw new KartError("No claim in review");
  updateOrder(orderId, { status: o.deliveredAt ? "delivered" : "paid" });
  return guaranteeCredit(orderId, { kind: "claim", reason: "Claim approved after review." });
}
