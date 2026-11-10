"use client";
import { Button } from "@lemonsqueezy/wedges";
import { useEffect, useState } from "react";
import { Ban, Hand, ShieldCheck, Wallet, X, Zap } from "lucide-react";
import { api, useApp, usd0 as usd } from "./app-context";
import { useToast } from "./ui";

function Tier({ label, hint, icon: Icon, tone, value, min, max, step, onChange, unit }: any) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-[13.5px] font-medium">
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${tone}`}>
            <Icon size={14} />
          </span>
          {label}
        </span>
        <span className="rounded-lg bg-sunken px-2 py-0.5 text-[15px] font-semibold tabular-nums">{unit ? `${value} ${unit}` : usd(value)}</span>
      </div>
      <input type="range" className="mt-3.5 w-full accent-[#0070E0]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

export default function RulesDrawer() {
  const { rules, rulesOpen, setRulesOpen, refreshRules, monthSpent } = useApp();
  const toast = useToast();
  const [auto, setAuto] = useState(30);
  const [max, setMax] = useState(50);
  const [cap, setCap] = useState(200);
  const [perHour, setPerHour] = useState(5);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (rules) {
      setAuto(rules.autoBuyUnder);
      setMax(rules.perItemMax);
      setCap(rules.monthlyCap);
      setPerHour(rules.maxOrdersPerHour ?? 5);
    }
  }, [rules, rulesOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRulesOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setRulesOpen]);
  if (!rulesOpen) return null;
  const save = async (extra: Record<string, unknown> = {}) => {
    setSaving(true);
    try {
      await api("/api/rules", { autoBuyUnder: auto, perItemMax: max, monthlyCap: cap, maxOrdersPerHour: perHour, ...extra }, "PUT");
      await refreshRules();
      toast({ tone: "success", title: extra.revokeMandate ? "Agent Mandate revoked" : "Rules saved", text: extra.revokeMandate ? "Kart can no longer pay without asking you." : `Auto-buy ≤ ${usd(auto)}, ask ≤ ${usd(max)}, cap ${usd(cap)}/month.` });
      if (!extra.revokeMandate) setRulesOpen(false);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close" className="flex-1 bg-ink/25 backdrop-blur-[2px]" onClick={() => setRulesOpen(false)} />
      <div className="anim-in flex h-full w-full max-w-[440px] flex-col border-l border-line bg-surface shadow-[var(--shadow-pop)]">
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-[16px] font-semibold">
              <ShieldCheck size={18} className="text-success" /> Spending rules
            </h2>
            <p className="mt-1 text-[13px] text-muted">Enforced on Kart's server with signed approvals. The AI can't change or skip them.</p>
          </div>
          <button aria-label="Close" onClick={() => setRulesOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-sunken hover:text-ink">
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          {/* visual scale */}
          <div className="rounded-xl bg-sunken p-4">
            <div className="flex h-2.5 overflow-hidden rounded-full">
              <div className="bg-success" style={{ width: `${(auto / Math.max(max, 1)) * 70}%` }} />
              <div className="bg-action" style={{ width: `${70 - (auto / Math.max(max, 1)) * 70}%` }} />
              <div className="flex-1 bg-danger/70" />
            </div>
            <div className="mt-2 flex justify-between text-[11.5px] text-muted">
              <span>Kart buys · ≤ {usd(auto)}</span>
              <span>Asks you · ≤ {usd(max)}</span>
              <span>Blocked</span>
            </div>
          </div>
          <Tier label="Kart buys on its own up to" hint="Paid with your saved PayPal, no popup. Undo within 10 minutes." icon={Zap} tone="bg-success-tint text-success" value={auto} min={0} max={max} step={5} onChange={setAuto} />
          <Tier
            label="Ask me first up to"
            hint="Above the auto-buy limit Kart shows the order and pays only when you tap Confirm."
            icon={Hand}
            tone="bg-tint text-action"
            value={max}
            min={10}
            max={300}
            step={5}
            onChange={(v: number) => {
              setMax(v);
              if (auto > v) setAuto(v);
            }}
          />
          <Tier label="Monthly cap" hint={`Spent this month: $${monthSpent.toFixed(2)}. Anything past the cap is blocked.`} icon={Ban} tone="bg-danger-tint text-danger" value={cap} min={50} max={1000} step={10} onChange={setCap} />
          <Tier label="Max orders per hour" hint="Safety brake: stops a runaway agent or a stolen session from placing many orders." icon={ShieldCheck} tone="bg-warn-tint text-warn" value={perHour} min={1} max={20} step={1} unit="orders" onChange={setPerHour} />
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5 text-[13.5px] font-medium">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-warn-tint text-warn">
                  <Wallet size={14} />
                </span>
                Agent Mandate
              </span>
              <span className={`badge ${rules?.mandateActive ? "bg-success-tint text-success" : "bg-sunken text-muted"}`}>{rules?.mandateActive ? "Connected" : "Not connected"}</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              {rules?.mandateActive
                ? "Your PayPal is saved in PayPal's vault. Kart never sees your login or card. Orders are paid in one tap after you confirm, or on their own under your auto-buy limit."
                : "Pay once with PayPal and keep “Save PayPal” on. After that, orders are one tap: confirm and Kart pays."}
            </p>
            {rules?.mandateActive && (
              <Button variant="outline" size="sm" className="mt-3 text-danger"  disabled={saving} onClick={() => save({ revokeMandate: true })}>
                Revoke access
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-2 border-t border-line p-4">
          <Button variant="outline" className="flex-1"  onClick={() => setRulesOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1"  disabled={saving} onClick={() => save()}>
            {saving ? "Saving…" : "Save rules"}
          </Button>
        </div>
      </div>
    </div>
  );
}
