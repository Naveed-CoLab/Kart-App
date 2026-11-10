import { requireRole } from "@/lib/session";
import { KartError } from "@/lib/orders";
import { handle, sameOrigin } from "@/lib/http";
import { startCheckout } from "@/lib/orders";

export async function POST(req: Request) {
  return handle(async () => {
    await requireRole("shopper");
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const b = await req.json();
    const r = await startCheckout({ productId: b.productId, chatId: b.chatId, token: b.token, saveMandate: b.saveMandate, fundingSource: b.fundingSource });
    return { id: r.paypalOrderId, orderId: r.orderId, vaultRequested: r.vaultRequested };
  });
}
