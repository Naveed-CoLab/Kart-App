import { requireRole } from "@/lib/session";
import { handle } from "@/lib/http";
import { KartError, markShipped } from "@/lib/orders";
import { asTenant, getOrder } from "@/lib/db";
import { assertStoreAction, storeOrderOwner } from "@/lib/stores";

/** Store action: mark shipped with the real carrier tracking number (added to the PayPal transaction). */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireRole("store");
    assertStoreAction(session);
    const { orderId, trackingNumber, carrier } = (await req.json()) as Record<string, unknown>;
    if (typeof orderId !== "string" || !orderId) throw new KartError("orderId required");
    const CARRIERS: Record<string, string> = { USPS: "USPS", UPS: "UPS", FEDEX: "FedEx", DHL: "DHL" };
    const c = (typeof carrier === "string" && CARRIERS[carrier.toUpperCase()]) || "USPS";
    // The order lives in the shopper's data; act on it there.
    const owner = storeOrderOwner(session, orderId);
    if (!owner) throw new KartError("Order not found", 404);
    return asTenant(owner, async () => {
    const o = getOrder(orderId);
    if (!o) throw new KartError("Order not found", 404);
    const done = await markShipped(orderId, String(trackingNumber ?? ""), c);
    return { order: { ...done, payerEmail: null } };
    });
  });
}
