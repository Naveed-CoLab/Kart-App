import { getSession, tenantOf } from "@/lib/session";
import { asTenant, db } from "@/lib/db";
import { storeOrderOwner } from "@/lib/stores";
import { ok } from "@/lib/http";
import { getProduct } from "@/lib/channel3";

export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s) return ok({ error: "not found" }, { status: 404 });
  // Shoppers read their own data; a store reads the order from whichever shopper placed it.
  const tenant = s.role === "store" ? storeOrderOwner(s, id) : tenantOf(s);
  return asTenant(tenant, () => {
    const order = db().orders.find((o) => o.id === id);
    if (!order) return ok({ error: "not found" }, { status: 404 });
    const events = db().events.filter((e) => e.orderId === id);
    const claims = db().claims.filter((c) => c.orderId === id).map((c) => ({ ...c, imagePath: null }));
    return ok({ order: s.role === "store" ? { ...order, payerEmail: null } : order, events, claims, product: getProduct(order.productId) || null });
  });
}
