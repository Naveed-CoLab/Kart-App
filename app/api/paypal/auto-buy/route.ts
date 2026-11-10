import { requireRole } from "@/lib/session";
import { KartError } from "@/lib/orders";
import { handle, sameOrigin } from "@/lib/http";
import { autoBuy, undoAutoBuy } from "@/lib/orders";

export async function POST(req: Request) {
  return handle(async () => {
    await requireRole("shopper");
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const b = await req.json();
    if (b.undoOrderId) return await undoAutoBuy(b.undoOrderId);
    return { order: await autoBuy(b.productId, b.chatId) };
  });
}
