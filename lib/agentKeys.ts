/**
 * Agent keys: let an outside AI agent shop through Kart for one shopper, inside that shopper's rules.
 *
 * Security model
 *  - Keys are 192-bit random secrets ("kart_…"). Only a SHA-256 hash is stored; the key is shown once.
 *  - Least privilege per agent, on top of the shopper's own rules:
 *      canBuy       false = search and read only
 *      canAutoBuy   off by default: every purchase waits for the shopper's OK in Kart
 *      monthlyBudget the most this agent may spend in a calendar month (never above the shopper's cap)
 *      expiresAt    keys expire (30 days by default)
 *  - Revoked or expired keys stop working at once. Agents never see PayPal details.
 */
import crypto from "crypto";
import { now, round2, uid } from "./config";
import { asTenant, db, mutate } from "./db";
import { PLATFORM } from "./stores";
import { KartError } from "./orders";
import type { AgentKey } from "./types";

const hash = (k: string) => crypto.createHash("sha256").update(k).digest("hex");
const onPlatform = <T>(fn: () => T) => asTenant(PLATFORM, fn);
const DAY = 86_400_000;
export const MAX_AGENTS = 10;

export type AgentSettings = { canBuy: boolean; canAutoBuy: boolean; monthlyBudget: number; expiresInDays: number | null };

/** Defaults for new and older keys: can ask to buy, can't pay on its own, $50 a month, 30 days. */
export const permissions = (k: AgentKey) => ({
  canBuy: k.canBuy ?? true,
  canAutoBuy: k.canAutoBuy ?? false,
  monthlyBudget: k.monthlyBudget ?? 50,
  expiresAt: k.expiresAt ?? null,
});

const clampBudget = (n: unknown, cap: number) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new KartError("Enter a monthly budget above $0 for this agent.");
  return Math.min(round2(v), cap);
};
const expiry = (days: number | null) => (days ? new Date(Date.now() + days * DAY).toISOString() : null);
const cleanLabel = (l: unknown) => String(l ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) || "AI agent";

export function createAgentKey(tenant: string, label: string, s: AgentSettings, shopperCap: number) {
  const key = `kart_${crypto.randomBytes(24).toString("base64url")}`;
  const rec: AgentKey = {
    id: uid("ak_"),
    hash: hash(key),
    tenant,
    label: cleanLabel(label),
    hint: key.slice(-4),
    createdAt: now(),
    lastUsedAt: null,
    revokedAt: null,
    canBuy: !!s.canBuy,
    canAutoBuy: !!s.canBuy && !!s.canAutoBuy,
    monthlyBudget: clampBudget(s.monthlyBudget, shopperCap),
    expiresAt: expiry(s.expiresInDays),
  };
  onPlatform(() =>
    mutate((d) => {
      (d.agentKeys ??= {})[rec.hash] = rec;
    }),
  );
  return { key, record: rec };
}

const live = (k: AgentKey) => !k.revokedAt && !(k.expiresAt && Date.parse(k.expiresAt) < Date.now());

export function listAgentKeys(tenant: string): AgentKey[] {
  return onPlatform(() => Object.values(db().agentKeys || {}))
    .filter((k) => k.tenant === tenant && !k.revokedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const activeAgentCount = (tenant: string) => listAgentKeys(tenant).filter(live).length;

function updateKey(tenant: string, id: string, fn: (k: AgentKey) => void) {
  return onPlatform(() =>
    mutate((d) => {
      const k = Object.values(d.agentKeys || {}).find((x) => x.id === id && x.tenant === tenant);
      if (!k) throw new KartError("That agent isn't connected to your account.", 404);
      fn(k);
      return { ...k };
    }),
  );
}

export function updateAgentKey(tenant: string, id: string, patch: Partial<{ canBuy: boolean; canAutoBuy: boolean; monthlyBudget: number; extendDays: number }>, shopperCap: number) {
  return updateKey(tenant, id, (k) => {
    if (k.revokedAt) throw new KartError("This agent was disconnected.", 409);
    if (typeof patch.canBuy === "boolean") k.canBuy = patch.canBuy;
    if (typeof patch.canAutoBuy === "boolean") k.canAutoBuy = patch.canAutoBuy;
    if (k.canBuy === false) k.canAutoBuy = false;
    if (patch.monthlyBudget !== undefined) k.monthlyBudget = clampBudget(patch.monthlyBudget, shopperCap);
    if (patch.extendDays) k.expiresAt = expiry(Math.min(365, Math.max(1, Math.floor(patch.extendDays))));
  });
}

export function revokeAgentKey(tenant: string, id: string) {
  return updateKey(tenant, id, (k) => {
    k.revokedAt ??= now();
  });
}

export function revokeAllAgentKeys(tenant: string) {
  return onPlatform(() =>
    mutate((d) => {
      let n = 0;
      for (const k of Object.values(d.agentKeys || {}))
        if (k.tenant === tenant && !k.revokedAt) {
          k.revokedAt = now();
          n++;
        }
      return n;
    }),
  );
}

/** Which shopper (and which agent) a key belongs to; null if unknown, revoked or expired. */
export function resolveAgentKey(key: string | null | undefined): AgentKey | null {
  if (!key || !/^kart_[A-Za-z0-9_-]{32}$/.test(key)) return null;
  const h = hash(key);
  const rec = onPlatform(() => db().agentKeys?.[h]);
  if (!rec || !live(rec)) return null;
  const last = rec.lastUsedAt ? new Date(rec.lastUsedAt).getTime() : 0;
  if (Date.now() - last > 60_000)
    onPlatform(() =>
      mutate((d) => {
        d.agentKeys![h].lastUsedAt = now();
      }),
    );
  return rec;
}

/** What this agent's purchases cost the shopper this calendar month (runs inside the shopper's tenant). */
export function agentSpentThisMonth(agentId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return round2(
    db()
      .orders.filter((o) => o.agentKeyId === agentId && !["created", "refunded", "cancelled"].includes(o.status) && Date.parse(o.paidAt || o.createdAt) >= start.getTime())
      .reduce((t, o) => t + o.price, 0),
  );
}
