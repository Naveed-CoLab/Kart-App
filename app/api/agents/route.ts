import { activeAgentCount, agentSpentThisMonth, createAgentKey, listAgentKeys, MAX_AGENTS, permissions, revokeAgentKey, revokeAllAgentKeys, updateAgentKey } from "@/lib/agentKeys";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";
import { KartError } from "@/lib/orders";
import { MIN, rateLimit } from "@/lib/rateLimit";
import { requireRole } from "@/lib/session";
import type { AgentKey } from "@/lib/types";

export const dynamic = "force-dynamic";

/** What the browser may see about an agent: never the key hash or the shopper id. */
function pub(k: AgentKey) {
  const p = permissions(k);
  const expired = !!(p.expiresAt && Date.parse(p.expiresAt) < Date.now());
  const recent = db()
    .events.filter((e) => e.agent === k.label && ["decision", "blocked", "auto_buy", "payment"].includes(e.type))
    .slice(0, 3)
    .map((e) => ({ at: e.createdAt, type: e.type, amount: e.amount ?? null, text: e.reason.slice(0, 140) }));
  return { id: k.id, label: k.label, hint: k.hint, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, ...p, expired, spentThisMonth: agentSpentThisMonth(k.id), recent };
}

const DAYS = new Set([7, 30, 90, 365]);
const days = (v: unknown) => (v === null || v === "never" ? null : DAYS.has(Number(v)) ? Number(v) : 30);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** The shopper's connected agents. */
export async function GET() {
  return handle(async () => {
    const s = await requireRole("shopper");
    return { agents: listAgentKeys(s.uid!).map(pub), base: `${config.appUrl}/api/mcp`, limits: { autoBuyUnder: db().rules.autoBuyUnder, monthlyCap: db().rules.monthlyCap } };
  });
}

/**
 * { create: { label, monthlyBudget, canBuy, canAutoBuy, expiresInDays } }  → the key, returned once
 * { update: id, canBuy?, canAutoBuy?, monthlyBudget?, extendDays? }
 * { revoke: id } | { revokeAll: true }
 * (Legacy: { label } creates with safe defaults.)
 */
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireRole("shopper");
    rateLimit(`agents:${s.uid}`, 20, MIN);
    const b = (await req.json().catch(() => ({}))) as Record<string, any>;
    const cap = db().rules.monthlyCap;
    if (b.revokeAll === true) return { revoked: revokeAllAgentKeys(s.uid!) };
    if (typeof b.revoke === "string") return { agent: pub(revokeAgentKey(s.uid!, b.revoke)) };
    if (typeof b.update === "string")
      return {
        agent: pub(
          updateAgentKey(
            s.uid!,
            b.update,
            {
              canBuy: typeof b.canBuy === "boolean" ? b.canBuy : undefined,
              canAutoBuy: typeof b.canAutoBuy === "boolean" ? b.canAutoBuy : undefined,
              monthlyBudget: b.monthlyBudget,
              extendDays: b.extendDays ? Number(b.extendDays) : undefined,
            },
            cap,
          ),
        ),
      };
    const c = (b.create ?? b) as Record<string, any>;
    if (activeAgentCount(s.uid!) >= MAX_AGENTS) throw new KartError(`You can connect up to ${MAX_AGENTS} agents. Disconnect one first.`);
    const { key, record } = createAgentKey(
      s.uid!,
      String(c.label || "AI agent"),
      { canBuy: bool(c.canBuy, true), canAutoBuy: bool(c.canAutoBuy, false), monthlyBudget: c.monthlyBudget ?? Math.min(50, cap), expiresInDays: days(c.expiresInDays) },
      cap,
    );
    return { key, url: `${config.appUrl}/api/mcp/${key}`, agent: pub(record) };
  });
}
