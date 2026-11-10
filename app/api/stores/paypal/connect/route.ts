import { handle, sameOrigin } from "@/lib/http";
import { KartError } from "@/lib/orders";
import { PayPalError, createPartnerReferral } from "@/lib/paypal";
import { requireStoreOwner } from "@/lib/session";
import { getStore } from "@/lib/stores";
import { config, hasPayPal } from "@/lib/config";

/** "Connect with PayPal": PayPal partner sign-up. Returns the PayPal link for the store owner. */
export async function POST(req: Request) {
  return handle(async () => {
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const s = await requireStoreOwner();
    const { domain } = await req.json();
    const rec = getStore(String(domain || ""));
    if (!rec || rec.ownerUid !== s.uid) throw new KartError("You haven't claimed this store.", 403);
    if (!rec.verified) throw new KartError("Verify your domain first.", 403);
    if (!hasPayPal()) throw new KartError("PayPal isn't set up on Kart yet.", 503);
    try {
      const url = await createPartnerReferral({ trackingId: rec.verifyToken.slice(-16), email: rec.paypalEmail, returnUrl: `${config.appUrl}/api/stores/paypal/return` });
      return { url };
    } catch (e) {
      const status = e instanceof PayPalError ? e.status : 500;
      // Most apps need PayPal to enable partner (marketplace) access first.
      throw new KartError(
        status === 401 || status === 403
          ? "PayPal hasn't enabled partner sign-up for Kart's app yet. Add your PayPal business email below instead; payments go straight to it."
          : `PayPal sign-up isn't available right now (${(e as Error).message}). Add your PayPal business email instead.`,
        502,
      );
    }
  });
}
