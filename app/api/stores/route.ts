import { handle, ok, sameOrigin } from "@/lib/http";
import { KartError } from "@/lib/orders";
import { getSession, requireStoreOwner } from "@/lib/session";
import { claimStore, DEMO_STORE, getStore, paidToLabel, storesOwnedBy } from "@/lib/stores";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

/** The signed-in store owner's stores, and the one that's open. */
export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "store") return ok({ stores: [], current: null });
  const demo = s.store === DEMO_STORE;
  const current = demo
    ? { domain: DEMO_STORE, demo: true, paidTo: config.storeEmail ? "Kart's sandbox store account" : "PayPal not set up", own: false }
    : s.store
      ? { domain: s.store, demo: false, ...(() => { const p = paidToLabel(s.store!); return { paidTo: p.label, own: p.own }; })(), record: getStore(s.store) }
      : null;
  return ok({ stores: storesOwnedBy(s.uid!), current, owner: s.name });
}

/** Claim a domain (step 1 of joining Kart as a store). */
export async function POST(req: Request) {
  return handle(async () => {
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const s = await requireStoreOwner();
    if (s.store === DEMO_STORE) throw new KartError("Sign in as a store owner to add your own store.", 403);
    const b = await req.json();
    return { store: claimStore(s.uid!, s.name, String(b.domain || ""), b.paypalEmail ? String(b.paypalEmail).trim() : null) };
  });
}
