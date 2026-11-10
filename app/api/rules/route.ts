import { requireRole } from "@/lib/session";
import { db, logEvent, monthSpent, mutate } from "@/lib/db";
import { asUser, handle, ok, sameOrigin } from "@/lib/http";
import { KartError } from "@/lib/orders";

export const dynamic = "force-dynamic";
/** The browser never sees the PayPal vault token or customer id. */
const pub = (r: ReturnType<typeof db>["rules"]) => ({ ...r, vaultId: r.vaultId ? "saved" : null, paypalCustomerId: null });
export async function GET() {
  return asUser(() => ok({ rules: pub(db().rules), monthSpent: monthSpent() }));
}
export async function PUT(req: Request) {
  return handle(async () => {
    if (!sameOrigin(req)) throw new KartError("Cross-site request refused", 403);
    await requireRole("shopper");
    const b = (await req.json()) as Record<string, unknown>;
    const r = { ...db().rules };
    // Every limit must be a real number in range: a NaN or huge value would quietly switch a guard off.
    const LIMITS = { autoBuyUnder: "Auto-buy limit", perItemMax: "Per-item max", monthlyCap: "Monthly cap" } as const;
    for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
      if (b[k] === undefined) continue;
      const v = Number(b[k]);
      if (b[k] === null || b[k] === "" || !Number.isFinite(v) || v < 0 || v > 10_000) throw new KartError(`${LIMITS[k]} must be a number between $0 and $10,000`);
      r[k] = Math.round(v * 100) / 100;
    }
    if (b.maxOrdersPerHour !== undefined) {
      const v = Number(b.maxOrdersPerHour);
      if (!Number.isFinite(v)) throw new KartError("Orders per hour must be a number");
      r.maxOrdersPerHour = Math.min(50, Math.max(1, Math.round(v)));
    }
    if (r.perItemMax > r.monthlyCap) throw new KartError("Per-item max can't be above the monthly cap");
    if (r.autoBuyUnder > r.perItemMax) throw new KartError("Auto-buy limit can't be above the per-item max");
    if (b.revokeMandate) Object.assign(r, { mandateActive: false, vaultId: null, paypalCustomerId: null });
    mutate((d) => {
      d.rules = r;
    });
    logEvent({ type: "rules", rule: "Rules updated", reason: b.revokeMandate ? "Agent Mandate revoked: Kart can no longer pay without you." : `Auto-buy ≤ $${r.autoBuyUnder}, ask ≤ $${r.perItemMax}, monthly cap $${r.monthlyCap}.` });
    return { rules: pub(r), monthSpent: monthSpent() };
  });
}
