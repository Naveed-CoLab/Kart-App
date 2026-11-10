import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setStorePayPal, storeByTracking } from "@/lib/stores";

export const dynamic = "force-dynamic";

/** PayPal sends the store owner back here after partner sign-up, with their PayPal merchant id. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const merchantId = url.searchParams.get("merchantIdInPayPal");
  const tracking = url.searchParams.get("merchantId");
  const s = await getSession();
  const rec = tracking ? storeByTracking(tracking) : null;
  if (!merchantId || !rec || !s?.uid || rec.ownerUid !== s.uid) return NextResponse.redirect(new URL("/store/connect?paypal=failed", url));
  setStorePayPal(s.uid, rec.domain, { merchantId });
  return NextResponse.redirect(new URL(`/store/connect?paypal=connected&domain=${encodeURIComponent(rec.domain)}`, url));
}
