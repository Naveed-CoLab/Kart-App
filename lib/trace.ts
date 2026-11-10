/**
 * Turns what Kart actually did (its decision-trail events) into the step-by-step trace the chat shows
 * while it works, like a "thinking" panel. Nothing here is invented: every step is a real event that
 * happened during the action (rules checked, live price re-checked, PayPal charged, store paid…).
 */
import { db } from "./db";
import type { KartEvent, UIItem } from "./types";
import { uid } from "./config";

type Step = Extract<UIItem, { kind: "step" }>;

/** Remember where the decision trail is now, to collect what happens next. */
export const eventMark = () => db().events[0]?.id ?? null;

/** Events logged after `mark`, oldest first. */
export function eventsSince(mark: string | null): KartEvent[] {
  const out: KartEvent[] = [];
  for (const e of db().events) {
    if (e.id === mark) break;
    out.push(e);
  }
  return out.reverse();
}

const short = (t: string, n = 180) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

/** One event → one readable step (or null for events that aren't worth showing). */
export function stepFor(e: KartEvent, tool = "kart"): Step | null {
  const base = { id: uid("ui_"), kind: "step" as const, tool, at: e.createdAt };
  const live = e.rule === "Live check" || e.rule === "Price lock";
  switch (e.type) {
    case "search": {
      const n = e.reason.match(/(\d+) results?/)?.[1];
      const what = e.reason.match(/"([^"]+)"(?: under \$[\d.]+)?/)?.[0];
      return { ...base, label: n ? `Found ${n} product${n === "1" ? "" : "s"}` : "Got results from Channel3", detail: what ? `For ${what}, in stock, inside your max price.` : short(e.reason), tone: "ok" };
    }
    case "decision":
      if (e.rule === "Top 3 + Kart pick") return { ...base, label: "Picked the best option", detail: short(e.reason.replace(/^Recommended \d+ options; /, "")), tone: "ok" };
      return live
        ? { ...base, label: "Re-checked the live price on Channel3", detail: short(e.reason), tone: "info" }
        : { ...base, label: `Checked your rules: ${e.rule || "spending rules"}`, detail: short(e.reason), tone: "info" };
    case "approval":
      return { ...base, label: "Verified your approval", detail: short(e.reason), tone: "ok" };
    case "blocked":
      return { ...base, label: live ? "Stopped: the price changed" : `Stopped by ${e.rule || "your rules"}`, detail: short(e.reason), tone: "stop" };
    case "auto_buy":
    case "payment":
      return { ...base, label: "Charged PayPal", detail: short(e.reason + (e.ref ? ` PayPal transaction ${e.ref}.` : "")), tone: "money" };
    case "store_paid":
      return { ...base, label: "Paid the store", detail: short(e.reason), tone: "money" };
    case "store_order":
      return { ...base, label: "Placed the order with the store", detail: short(e.reason), tone: "ok" };
    case "rules":
      return { ...base, label: "Saved your PayPal for one-tap", detail: short(e.reason), tone: "ok" };
    case "guarantee":
    case "price_drop":
      return { ...base, label: "Sent your money back (Kart Guarantee)", detail: short(e.reason + (e.ref ? ` Ref ${e.ref}.` : "")), tone: "money" };
    case "claim":
      return { ...base, label: "Reviewed your claim", detail: short(e.reason), tone: "info" };
    case "recovery":
      return { ...base, label: "Asked the store to cover it", detail: short(e.reason), tone: "info" };
    case "shipment":
      return { ...base, label: "Added tracking", detail: short(e.reason), tone: "ok" };
    default:
      return null;
  }
}

/** Steps for everything logged since `mark`. */
export const stepsSince = (mark: string | null, tool?: string) => eventsSince(mark).map((e) => stepFor(e, tool)).filter((s): s is Step => !!s);
