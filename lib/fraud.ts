/** Fraud risk score for damage claims (PRD §10.2). */
import type { VisionResult } from "./types";

export const RISK_THRESHOLD = 0.3;

export function scoreClaim(input: { vision: VisionResult; daysSinceDelivery: number; previousClaims: number }) {
  const reasons: string[] = [];
  let s = 0.05;
  reasons.push("Base risk 0.05");
  const conf = Math.max(0, Math.min(1, input.vision.confidence));
  const confTerm = Math.round(0.1 * (1 - conf) * 100) / 100;
  if (confTerm > 0) {
    s += confTerm;
    reasons.push(`Vision confidence ${Math.round(conf * 100)}% (+${confTerm.toFixed(2)})`);
  }
  if (!input.vision.damage_visible) {
    s += 0.4;
    reasons.push("Damage not clearly visible (+0.40)");
  } else reasons.push("Damage visible in photo");
  if (!input.vision.matches_product) {
    s += 0.4;
    reasons.push("Photo doesn't match the ordered product (+0.40)");
  } else reasons.push("Photo matches the ordered product");
  if (input.daysSinceDelivery > 30) {
    s += 0.3;
    reasons.push("Claim is outside the 30-day window (+0.30)");
  } else reasons.push("Within 30-day protection window");
  const prev = Math.min(input.previousClaims, 2);
  if (prev > 0) {
    s += 0.15 * prev;
    reasons.push(`${input.previousClaims} previous claim(s) (+${(0.15 * prev).toFixed(2)})`);
  } else reasons.push("No previous claims on this account");
  const score = Math.round(Math.min(1, s) * 100) / 100;
  return { score, reasons, decision: score < RISK_THRESHOLD ? ("auto_refund" as const) : ("store_review" as const) };
}
