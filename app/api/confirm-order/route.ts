import { requireRole } from "@/lib/session";
import { handle } from "@/lib/http";
import { confirmOrder, KartError } from "@/lib/orders";
import { sameOrigin } from "@/lib/http";

/** One-tap order with the saved PayPal, after the shopper confirms on the card. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireRole("shopper");
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const b = await req.json();
    if (!b.productId || !b.token) throw new KartError("productId and token required");
    return { order: await confirmOrder({ productId: b.productId, token: b.token, chatId: b.chatId, itemId: b.itemId }) };
  });
}
