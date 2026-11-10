import { handle, sameOrigin } from "@/lib/http";
import { KartError } from "@/lib/orders";
import { requireStoreOwner } from "@/lib/session";
import { verifyStore } from "@/lib/stores";
import { MIN, rateLimit } from "@/lib/rateLimit";

/** Prove domain ownership: DNS TXT record or a file at /.well-known/kart-verification.txt. */
export async function POST(req: Request) {
  return handle(async () => {
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const s = await requireStoreOwner();
    rateLimit(`verify:${s.uid}`, 10, MIN, "Too many checks. Wait a minute, then try again.");
    const b = await req.json();
    return { store: await verifyStore(s.uid!, String(b.domain || ""), b.method === "file" ? "file" : "dns") };
  });
}
