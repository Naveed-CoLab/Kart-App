import { db, monthSpent } from "@/lib/db";
import { asUser, ok } from "@/lib/http";
import { getSession } from "@/lib/session";
import type { KartEvent, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : null);
const r2 = (n: number) => Math.round(n * 100) / 100;

const HOW_PAID: Record<Order["buyMode"], string> = { auto: "Auto-buy (no tap)", confirmed: "One-tap (you confirmed)", popup: "PayPal checkout" };
const FUNDING = (o: Order) => (o.fundingSource === "paylater" ? "PayPal Pay Later" : o.fundingSource === "paypal_vault" ? "Saved PayPal" : "PayPal");
const STATUS: Record<string, string> = { paid: "Paid", shipped: "Shipped", delivered: "Delivered", refunded: "Refunded", claim_review: "Claim in review", cancelled: "Cancelled" };

/** One row per agent decision Kart logged: what was asked, what Kart did, and which rule decided it. */
function decisionRow(e: KartEvent) {
  const live = e.rule === "Live check";
  let outcome: string | null = null;
  if (e.type === "auto_buy") outcome = "Bought on its own";
  else if (e.type === "payment") outcome = "Bought after your OK";
  else if (e.type === "approval") outcome = "You approved";
  else if (e.type === "blocked") outcome = live ? "Stopped by live price check" : "Blocked by your rules";
  else if (e.type === "decision") outcome = live ? "Live price checked" : "Asked to buy";
  if (!outcome) return null;
  return {
    id: e.id,
    date: day(e.createdAt),
    time: e.createdAt,
    agent: e.agent || "Kart chat",
    outcome,
    protected: e.type === "blocked",
    // 1/0 flags so the dashboard can sum each outcome.
    boughtOnItsOwn: e.type === "auto_buy" ? 1 : 0,
    boughtAfterOk: e.type === "payment" ? 1 : 0,
    blocked: e.type === "blocked" ? 1 : 0,
    liveChecks: live ? 1 : 0,
    rule: e.rule || "",
    amount: e.amount ?? 0,
    orderId: e.orderId || "",
    reason: e.reason,
  };
}

export async function GET() {
  const s = await getSession();
  if (s?.role !== "shopper") return ok({ error: "Sign in as the shopper first." }, { status: 401 });
  return asUser(() => {
    const d = db();
    const orders = d.orders
      .filter((o) => o.status !== "created")
      .map((o) => {
        const paidBack = (o.credits || []).reduce((t, c) => t + c.amount, 0);
        // Older orders didn't store the comparison; fall back to the offers Channel3 returned for that product.
        const offers = d.products[o.productId]?.offers || [];
        const highest = o.highestStorePrice ?? (offers.length ? Math.max(...offers.map((x) => x.price)) : o.price);
        const compared = o.storesCompared ?? (offers.length || 1);
        return {
          id: o.id,
          date: day(o.paidAt || o.createdAt),
          product: o.title,
          store: o.store,
          agent: o.agent || "Kart chat",
          status: STATUS[o.status] || o.status,
          howPaid: HOW_PAID[o.buyMode] || o.buyMode,
          funding: FUNDING(o),
          route: o.merchant === "store" ? "Straight to the store" : "Kart → instant Payout",
          price: o.price,
          storesCompared: compared,
          savedVsOtherStores: r2(Math.max(0, highest - o.price)),
          paidBack: r2(paidBack),
          netSpent: r2(o.price - paidBack),
          paypalTransaction: o.paypalCaptureId || "",
        };
      });
    const decisions = d.events.map(decisionRow).filter(Boolean);
    const credits = d.orders.flatMap((o) =>
      (o.credits || []).map((c, i) => ({
        id: `${o.id}-${i}`,
        orderId: o.id,
        date: day(c.at),
        product: o.title,
        store: o.store,
        kind: c.kind === "claim" ? "Damage claim" : c.kind === "price_drop" ? "Price drop" : c.kind === "undo" ? "Undo" : "Lost package",
        amount: c.amount,
        via: c.via === "payout" ? "PayPal Payout" : "PayPal refund",
        recoveredFromStore: c.recovered ? "Yes" : "Not yet",
      })),
    );
    return ok({
      asOf: new Date().toISOString(),
      rules: { ...d.rules, vaultId: undefined, paypalCustomerId: undefined, payerEmail: undefined },
      monthSpent: monthSpent(),
      orders,
      decisions,
      credits,
    });
  });
}
