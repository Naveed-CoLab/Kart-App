"use client";
/**
 * The Rule Lane: Kart's signature visual. One track, three zones of where the shopper's money may go:
 *   green  — Kart pays on its own (up to the auto-buy limit)
 *   amber  — Kart asks first (up to the max per item)
 *   red    — never, no money moves (over the max)
 * Prices are pins on the lane, so every purchase shows at a glance which rule decided it.
 */
import type { CSSProperties } from "react";

export type LaneRules = { autoBuyUnder: number; perItemMax: number };
export type LanePin = { price: number; label?: string; id?: string };

const Z = {
  auto: { fill: "#1BAF7A", tint: "#E3F6EE", ink: "#0B6B48", name: "Pays on its own" },
  ask: { fill: "#E9A100", tint: "#FFF3D6", ink: "#8A5A00", name: "Asks you first" },
  never: { fill: "#C0362C", tint: "#FBE9E7", ink: "#A12A21", name: "Never" },
};
export const zoneOf = (price: number, r: LaneRules) => (price <= r.autoBuyUnder ? "auto" : price <= r.perItemMax ? "ask" : "never");
const money = (n: number) => `$${n % 1 ? n.toFixed(2) : n.toFixed(0)}`;

const hatch: CSSProperties = {
  backgroundColor: Z.never.tint,
  backgroundImage: `repeating-linear-gradient(135deg, ${Z.never.fill}33 0 2px, transparent 2px 7px)`,
};

export function RuleLane({ rules, pin, pins = [], size = "sm", className = "" }: { rules: LaneRules; pin?: number; pins?: LanePin[]; size?: "sm" | "lg"; className?: string }) {
  const all = [...pins.map((p) => p.price), pin ?? 0];
  // The lane runs a bit past the max so "Never" has room; prices beyond it sit at the far edge.
  const end = Math.max(rules.perItemMax * 1.4, Math.min(Math.max(...all) * 1.08, rules.perItemMax * 2.2));
  const at = (v: number) => `${Math.min(100, (v / end) * 100)}%`;
  const autoW = (rules.autoBuyUnder / end) * 100;
  const askW = ((rules.perItemMax - rules.autoBuyUnder) / end) * 100;
  const lg = size === "lg";
  const h = lg ? 34 : 10;
  const z = pin !== undefined ? zoneOf(pin, rules) : null;

  return (
    <div className={className} role="img" aria-label={`Spending lane: up to ${money(rules.autoBuyUnder)} Kart pays on its own, up to ${money(rules.perItemMax)} it asks you, above that never.${pin !== undefined ? ` This purchase: ${money(pin)}, ${Z[zoneOf(pin, rules)].name.toLowerCase()}.` : ""}`}>
      <div className="relative" style={{ paddingTop: pin !== undefined ? (lg ? 30 : 24) : lg ? 0 : 0 }}>
        {/* the pin for this purchase */}
        {pin !== undefined && z && (
          <div className="absolute top-0 -translate-x-1/2" style={{ left: at(pin) }}>
            <span className="lane-pin block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-white shadow-sm" style={{ background: Z[z].fill }}>
              {money(pin)}
            </span>
            <span className="mx-auto block h-2 w-px" style={{ background: Z[z].fill }} />
          </div>
        )}
        {/* purchases as dots on their own row, right above the lane */}
        {lg && pins.length > 0 && (
          <div className="relative mb-1.5 h-4">
            {pins.map((p, i) => (
              <span
                key={p.id ?? i}
                title={`${p.label ? p.label + " · " : ""}${money(p.price)}`}
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(16,24,40,0.12)]"
                style={{ left: at(p.price), background: Z[zoneOf(p.price, rules)].fill }}
              />
            ))}
          </div>
        )}
        <div className="relative flex overflow-hidden rounded-full" style={{ height: h }}>
          <div className="flex items-center" style={{ width: `${autoW}%`, background: lg ? Z.auto.tint : Z.auto.fill, opacity: !lg && z && z !== "auto" ? 0.35 : 1 }}>
            {lg && <span className="truncate pl-3 text-[12px] font-semibold" style={{ color: Z.auto.ink }}>{Z.auto.name}</span>}
          </div>
          <div className="flex items-center border-l-2 border-white" style={{ width: `${askW}%`, background: lg ? Z.ask.tint : Z.ask.fill, opacity: !lg && z && z !== "ask" ? 0.35 : 1 }}>
            {lg && <span className="truncate pl-3 text-[12px] font-semibold" style={{ color: Z.ask.ink }}>{Z.ask.name}</span>}
          </div>
          <div className="flex flex-1 items-center border-l-2 border-white" style={lg ? hatch : { ...hatch, backgroundColor: Z.never.fill, backgroundImage: "none", opacity: z && z !== "never" ? 0.35 : 1 }}>
            {lg && <span className="truncate pl-3 text-[12px] font-semibold" style={{ color: Z.never.ink }}>{Z.never.name}</span>}
          </div>
        </div>
        {/* limits under the lane */}
        <div className="relative mt-1.5 h-4 text-[11px] tabular-nums text-subtle">
          <span className="absolute left-0">$0</span>
          <span className="absolute -translate-x-1/2" style={{ left: at(rules.autoBuyUnder) }}>
            {money(rules.autoBuyUnder)}
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: at(rules.perItemMax) }}>
            {money(rules.perItemMax)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** One-line verdict that goes with a pin: which zone and what that means. */
export function laneVerdict(price: number, r: LaneRules) {
  const z = zoneOf(price, r);
  return {
    zone: z,
    color: Z[z].ink,
    text: z === "auto" ? `Inside your ${money(r.autoBuyUnder)} auto-buy zone` : z === "ask" ? `Between ${money(r.autoBuyUnder)} and ${money(r.perItemMax)}: needs your OK` : `Over your ${money(r.perItemMax)} max: no money moves`,
  };
}
