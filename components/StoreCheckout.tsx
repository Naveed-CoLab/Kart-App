"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import type { StoreOrder } from "@/lib/types";
import { StoreLogo } from "./logos";
import { Badge } from "./ui";

/**
 * Shows Kart's agent placing the order on the store's website.
 * Fresh orders replay the steps live; older orders show them completed.
 */
export function StoreCheckout({ so, store, compact }: { so: StoreOrder; store: string; compact?: boolean }) {
  const fresh = Date.now() - new Date(so.placedAt).getTime() < 30_000;
  const [shown, setShown] = useState(fresh ? 0 : so.steps.length);
  useEffect(() => {
    if (shown >= so.steps.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 350 : 700);
    return () => clearTimeout(t);
  }, [shown, so.steps.length]);
  const done = shown >= so.steps.length;
  const host = so.url.replace(/^https?:\/\//, "");
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* browser bar */}
      <div className="flex items-center gap-2 border-b border-line bg-sunken px-3 py-2">
        <span className="flex gap-1">
          <i className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <i className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <i className="h-2 w-2 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-[11.5px] text-muted">
          <Lock size={10} className="shrink-0" />
          <span className="truncate">{host}/checkout</span>
        </span>
        {so.mode === "demo" && <Badge tone="amber">Sandbox demo</Badge>}
      </div>
      <div className={compact ? "px-3.5 py-3" : "p-4"}>
        <div className="flex items-center gap-2.5">
          <StoreLogo domain={store} size={22} />
          <p className="min-w-0 flex-1 text-[12.5px] font-semibold">{done ? `Order placed on ${host}` : `Kart is checking out on ${host}…`}</p>
          {done && <span className="font-mono text-[11.5px] text-muted">#{so.number}</span>}
        </div>
        <ol className="mt-2.5 space-y-1.5">
          {so.steps.map((s, i) => {
            const state = i < shown ? "done" : i === shown ? "doing" : "todo";
            return (
              <li key={i} className={`flex items-center gap-2 text-[12px] transition-opacity ${state === "todo" ? "opacity-35" : ""}`}>
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${state === "done" ? "bg-success text-white" : "bg-sunken text-subtle"}`}>
                  {state === "done" ? <Check size={10} strokeWidth={3} /> : state === "doing" ? <Loader2 size={10} className="animate-spin" /> : null}
                </span>
                <span className={`truncate ${state === "done" ? "text-ink" : "text-muted"}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>
        {so.mode === "demo" && done && !compact && (
          <p className="mt-3 text-[11.5px] leading-snug text-subtle">
            Sandbox: the PayPal payment is real (sandbox money) but the store order is simulated. Live, Kart places it through the store’s checkout API.
          </p>
        )}
      </div>
    </div>
  );
}
