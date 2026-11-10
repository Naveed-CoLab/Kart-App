import { requireRole } from "@/lib/session";
import { KartError } from "@/lib/orders";
import { handle, sameOrigin } from "@/lib/http";
import { completeCheckout } from "@/lib/orders";

export async function POST(req: Request) {
  return handle(async () => {
    await requireRole("shopper");
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const b = await req.json();
    return { order: await completeCheckout({ paypalOrderId: b.paypalOrderId, chatId: b.chatId, itemId: b.itemId }) };
  });
}
