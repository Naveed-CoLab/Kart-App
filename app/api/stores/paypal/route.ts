import { handle, sameOrigin } from "@/lib/http";
import { KartError } from "@/lib/orders";
import { requireStoreOwner } from "@/lib/session";
import { setStorePayPal } from "@/lib/stores";

/** Set the PayPal business email that receives the store's payments. */
export async function POST(req: Request) {
  return handle(async () => {
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const s = await requireStoreOwner();
    const b = await req.json();
    return { store: setStorePayPal(s.uid!, String(b.domain || ""), { paypalEmail: String(b.paypalEmail || "").trim() || null }) };
  });
}
