/**
 * Budget guard (PRD §10.1). Runs server-side on EVERY money route; the model cannot bypass it.
 * Approval tokens are HMAC-signed, single-use, 10-minute, and bound to product + exact amount.
 */
import crypto from "crypto";
import { config, money, uid } from "./config";
import { db, monthSpent, mutate } from "./db";
import type { Rules } from "./types";

export type GuardDecision = {
  decision: "auto" | "needs_approval" | "blocked";
  rule: string;
  reason: string;
  monthSpent: number;
};

export function decide(amount: number, rules: Rules = db().rules): GuardDecision {
  const spent = monthSpent();
  if (amount > rules.perItemMax)
    return { decision: "blocked", rule: `Per-item max $${rules.perItemMax}`, reason: `$${money(amount)} is over your $${rules.perItemMax} per-item max.`, monthSpent: spent };
  if (spent + amount > rules.monthlyCap)
    return {
      decision: "blocked",
      rule: `Monthly cap $${rules.monthlyCap}`,
      reason: `You've spent $${money(spent)} this month; $${money(amount)} more would pass your $${rules.monthlyCap} cap.`,
      monthSpent: spent,
    };
  if (amount <= rules.autoBuyUnder)
    return {
      decision: "auto",
      rule: `Auto-buy up to $${rules.autoBuyUnder}`,
      reason: rules.mandateActive ? `Under your $${rules.autoBuyUnder} auto-buy limit, so Kart can pay with your saved PayPal.` : `Under your $${rules.autoBuyUnder} auto-buy limit (one tap to pay).`,
      monthSpent: spent,
    };
  return {
    decision: "needs_approval",
    rule: `Ask first above $${rules.autoBuyUnder}`,
    reason: `$${money(amount)} is above your $${rules.autoBuyUnder} auto-buy limit, so Kart needs your approval.`,
    monthSpent: spent,
  };
}

/**
 * Extra safety checks on top of the spending rules (all server-side):
 *  - velocity: at most N paid orders per hour (stops a runaway agent or a stolen session)
 *  - duplicate: the same product bought in the last 24h needs a deliberate re-confirm
 *  - new store: first purchase from a store is flagged on the confirmation card
 */
export function safetyChecks(productId: string, store: string) {
  const d = db();
  const hourAgo = Date.now() - 3600_000;
  const dayAgo = Date.now() - 86400_000;
  const paid = d.orders.filter((o) => o.paidAt && o.status !== "refunded");
  const lastHour = paid.filter((o) => new Date(o.paidAt!).getTime() > hourAgo).length;
  const max = d.rules.maxOrdersPerHour ?? 5;
  const blocks: string[] = [];
  const warnings: string[] = [];
  if (lastHour >= max) blocks.push(`Safety limit: ${lastHour} orders in the last hour (max ${max}). Try again later.`);
  if (paid.some((o) => o.productId === productId && new Date(o.paidAt!).getTime() > dayAgo)) warnings.push("You bought this same item in the last 24 hours.");
  if (!paid.some((o) => o.store === store)) warnings.push(`First order from ${store}.`);
  return { blocks, warnings };
}

const sign = (payload: string) => crypto.createHmac("sha256", config.approvalSecret).update(payload).digest("base64url");

export function issueApprovalToken(productId: string, amount: number): string {
  const exp = Date.now() + 10 * 60_000;
  const nonce = uid();
  const payload = `${productId}|${money(amount)}|${exp}|${nonce}`;
  mutate((d) => {
    d.approvals[nonce] = { used: false, exp };
  });
  return Buffer.from(payload).toString("base64url") + "." + sign(payload);
}

/** Verify and consume a token. Returns an error string, or null if valid. */
export function consumeApprovalToken(token: string | undefined, productId: string, amount: number): string | null {
  if (!token) return "Approval required for this amount.";
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return "Malformed approval token.";
  const payload = Buffer.from(b64, "base64url").toString();
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return "Invalid approval signature.";
  const [pid, amt, exp, nonce] = payload.split("|");
  if (pid !== productId) return "Approval was for a different product.";
  if (amt !== money(amount)) return "Approval amount doesn't match.";
  if (Date.now() > Number(exp)) return "Approval expired. Please approve again.";
  const rec = db().approvals[nonce];
  if (!rec || rec.used) return "Approval already used.";
  mutate((d) => {
    d.approvals[nonce].used = true;
  });
  return null;
}
