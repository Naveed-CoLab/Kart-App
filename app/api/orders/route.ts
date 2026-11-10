import { asTenant, db, monthSpent } from "@/lib/db";
import { ordersForStore } from "@/lib/stores";
import { ok } from "@/lib/http";
import { getSession, tenantOf } from "@/lib/session";

export const dynamic = "force-dynamic";
/** Shoppers see their orders and decision trail; a store sees only its own orders. */
export async function GET() {
  const s = await getSession();
  if (!s) return ok({ error: "Please sign in first." }, { status: 401 });
  if (s.role === "store") {
    // A store sees its own orders from every shopper (the demo store: this browser's own orders), without shopper emails.
    if (!s.store) return ok({ error: "Finish setting up your store first." }, { status: 403 });
    const parts = ordersForStore(s);
    const orders = parts.flatMap((p) => p.orders.map((o) => ({ ...o, payerEmail: null }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const events = parts.flatMap((p) => p.events).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const claims = parts.flatMap((p) => p.claims.map((c) => ({ ...c, imagePath: null })));
    return ok({ orders, events: events.slice(0, 80), claims, watches: [], rules: null, monthSpent: 0 });
  }
  return asTenant(tenantOf(s), () => {
  const d = db();
  return ok({ orders: d.orders, events: d.events.slice(0, 80), claims: d.claims.map((c) => ({ ...c, imagePath: null })), watches: d.watches, rules: d.rules, monthSpent: monthSpent() });
  });
}
