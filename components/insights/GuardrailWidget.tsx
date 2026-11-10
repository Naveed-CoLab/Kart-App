"use client";
// Kart's custom AG Studio widget: the shopper's spending rules as a live guardrail. It shows this
// month's spend against the cap, the auto-buy and per-item limits on one scale, and how many times
// the rules stopped an agent. Rules and counts (from the decision trail) come in through Studio's `context`.
import type { AgWidgetParams } from "ag-studio";
import type { AgWidgetDefinition } from "ag-studio-react";

export type GuardrailContext = {
  rules: { autoBuyUnder: number; perItemMax: number; monthlyCap: number; mandateActive?: boolean };
  monthSpent: number;
  counts: { auto: number; ok: number; stopped: number };
};

const usd = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;

function Guardrail({ context }: AgWidgetParams) {
  const ctx = context as GuardrailContext | undefined;
  if (!ctx) return null;
  const { rules, monthSpent, counts } = ctx;
  const pct = Math.min(100, (monthSpent / rules.monthlyCap) * 100);
  const left = Math.max(0, rules.monthlyCap - monthSpent);
  const autoPct = Math.min(100, (rules.autoBuyUnder / rules.perItemMax) * 100);
  const muted = "var(--color-muted)";

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", gap: 12, padding: "2px 2px 2px", fontFamily: "inherit", overflow: "hidden" }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{usd(monthSpent)}</span>
          <span style={{ fontSize: 12.5, color: muted }}>of {usd(rules.monthlyCap)} this month</span>
        </div>
        <div style={{ marginTop: 8, height: 8, borderRadius: 99, background: "var(--color-sunken)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: pct > 85 ? "var(--color-danger)" : "var(--color-action)" }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: muted }}>{usd(left)} left before Kart stops all buying</div>
      </div>

      <div>
        <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${autoPct}%`, background: "var(--color-success)" }} />
          <div style={{ flex: 1, background: "#EDA100" }} />
          <div style={{ width: 10, background: "var(--color-danger)" }} />
        </div>
        <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12, color: muted }}>
          {[
            ["var(--color-success)", `Up to ${usd(rules.autoBuyUnder)}`, "buys on its own"],
            ["#EDA100", `${usd(rules.autoBuyUnder)} to ${usd(rules.perItemMax)}`, "asks you first"],
            ["var(--color-danger)", `Over ${usd(rules.perItemMax)}`, "never, no money moves"],
          ].map(([c, a, b]) => (
            <div key={a} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: c, flexShrink: 0 }} />
              <b style={{ color: "var(--color-ink)", fontWeight: 600 }}>{a}</b> {b}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
        {(
          [
            ["On its own", counts.auto, "var(--color-success)"],
            ["After OK", counts.ok, "var(--color-action)"],
            ["Stopped", counts.stopped, "var(--color-danger)"],
          ] as const
        ).map(([label, n, color]) => (
          <div key={label} style={{ minWidth: 0, borderRadius: 10, background: "var(--color-sunken)", padding: "6px 8px" }}>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2, color }}>{n}</div>
            <div style={{ fontSize: 11, color: muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const guardrailWidget: AgWidgetDefinition<"kart-guardrail"> = {
  id: "kart-guardrail",
  label: "Kart guardrail",
  form: ({ createDefaults }) => createDefaults({}),
  defaultState: { format: { title: { enabled: true, text: "Your rules right now" } } } as never,
  comp: Guardrail,
  defaultSize: { width: 8, height: 18 },
  minSize: { width: 6, height: 14 },
  ai: {
    label: "Kart guardrail",
    description: "The shopper's spending rules: this month's spend against the monthly cap, the auto-buy and per-item limits, and how often the rules stopped an agent.",
    usage: "Add when the shopper asks about their limits, how much is left this month, or how often Kart stopped a purchase. It needs no field mapping.",
  },
};
