import { requireRole } from "@/lib/session";
import { handle, sameOrigin } from "@/lib/http";
import { KartError, markDelivered, priceCheck, reportNotReceived } from "@/lib/orders";

/** Shopper actions on an order: confirm it arrived, report it missing, or run a Price Guard check. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireRole("shopper");
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const { id } = await params;
    const { action } = await req.json();
    if (action === "received") return { order: await markDelivered(id) };
    if (action === "not_received") return await reportNotReceived(id);
    if (action === "price_check") return await priceCheck(id);
    throw new KartError("Unknown action");
  });
}
