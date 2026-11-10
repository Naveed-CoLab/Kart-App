import { requireRole } from "@/lib/session";
import { handle } from "@/lib/http";
import { asTenant, getOrder } from "@/lib/db";
import { assertStoreAction, storeOrderOwner } from "@/lib/stores";
import { approveClaim, KartError, recoverFromStore } from "@/lib/orders";

/** Store actions for the Kart Guarantee: approve a claim in review, or settle money Kart paid back. */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireRole("store");
    assertStoreAction(session, true);
    const { orderId, action } = await req.json();
    if (typeof orderId !== "string" || !orderId) throw new KartError("orderId required");
    // The order lives in the shopper's data; act on it there.
    const owner = storeOrderOwner(session, orderId);
    if (!owner) throw new KartError("Order not found", 404);
    return asTenant(owner, async () => {
    const o = getOrder(orderId);
    if (!o) throw new KartError("Order not found", 404);
    if (action === "approve_claim") return await approveClaim(orderId);
    if (action === "recover") return { order: { ...(await recoverFromStore(orderId)), payerEmail: null } };
    throw new KartError("Unknown action");
    });
  });
}
