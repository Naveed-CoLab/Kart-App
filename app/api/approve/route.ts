import { requireRole } from "@/lib/session";
import { getProduct } from "@/lib/channel3";
import { decide, issueApprovalToken, safetyChecks } from "@/lib/guard";
import { handle, sameOrigin } from "@/lib/http";
import { KartError } from "@/lib/orders";

/**
 * Called only when the shopper taps Confirm / Pay on a card: issues a signed, single-use, 10-minute token
 * bound to this product and exact price. The AI agent has no tool that can call this.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await requireRole("shopper");
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    const { productId } = await req.json();
    const p = getProduct(productId);
    if (!p) throw new KartError("Unknown product", 404);
    const g = decide(p.price);
    if (g.decision === "blocked") throw new KartError(g.reason, 403);
    const safety = safetyChecks(p.id, p.store);
    if (safety.blocks.length) throw new KartError(safety.blocks[0], 429);
    return { token: issueApprovalToken(p.id, p.price), decision: g, warnings: safety.warnings };
  });
}
