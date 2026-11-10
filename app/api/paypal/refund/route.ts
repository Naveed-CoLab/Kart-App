import { requireRole } from "@/lib/session";
import { handle } from "@/lib/http";
import { asTenant, getOrder } from "@/lib/db";
import { assertStoreAction, storeOrderOwner } from "@/lib/stores";
import { guaranteeCredit, KartError } from "@/lib/orders";

/** Full money-back for an order under the Kart Guarantee (used by reviewers). */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireRole("store");
    assertStoreAction(session, true);
    const b = (await req.json()) as { orderId?: unknown; reason?: unknown };
    if (typeof b.orderId !== "string" || !b.orderId) throw new KartError("orderId required");
    const reason = typeof b.reason === "string" && b.reason.trim() ? b.reason.trim().slice(0, 200) : "Approved by Kart support.";
    const orderId = b.orderId;
    // The order lives in the shopper's data; act on it there.
    const owner = storeOrderOwner(session, orderId);
    if (!owner) throw new KartError("Order not found", 404);
    return asTenant(owner, async () => {
    const o = getOrder(orderId);
    if (!o) throw new KartError("Order not found", 404);
    return await guaranteeCredit(orderId, { kind: "claim", reason });
    });
  });
}
