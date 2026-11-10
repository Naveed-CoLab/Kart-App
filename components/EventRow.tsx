"use client";
import Link from "next/link";
import { Ban, Brain, CheckCircle2, CreditCard, Eye, HandCoins, PackageCheck, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Store, TrendingDown, Truck, Undo2, Webhook, Zap } from "lucide-react";
import type { KartEvent } from "@/lib/types";
import { usd } from "./app-context";
import { ago } from "./ui";

export const EVENT_META: Record<KartEvent["type"], { icon: any; cls: string; label: string }> = {
  search: { icon: Search, cls: "bg-sunken text-muted", label: "Search" },
  decision: { icon: Brain, cls: "bg-tint text-action", label: "Agent decision" },
  approval: { icon: CheckCircle2, cls: "bg-tint text-navy", label: "You approved" },
  payment: { icon: CreditCard, cls: "bg-tint text-navy", label: "Payment" },
  auto_buy: { icon: Zap, cls: "bg-success-tint text-success", label: "Auto-buy" },
  store_paid: { icon: Store, cls: "bg-tint text-navy", label: "Store paid" },
  store_order: { icon: ShoppingBag, cls: "bg-tint text-action", label: "Store order" },
  shipment: { icon: Truck, cls: "bg-violet-tint text-violet", label: "Shipped" },
  delivery: { icon: PackageCheck, cls: "bg-success-tint text-success", label: "Delivered" },
  guarantee: { icon: ShieldCheck, cls: "bg-success-tint text-success", label: "Kart Guarantee" },
  recovery: { icon: HandCoins, cls: "bg-sunken text-muted", label: "Recovered" },
  price_drop: { icon: TrendingDown, cls: "bg-success-tint text-success", label: "Price Guard" },
  claim: { icon: Eye, cls: "bg-violet-tint text-violet", label: "Claim check" },
  webhook: { icon: Webhook, cls: "bg-violet-tint text-violet", label: "PayPal webhook" },
  blocked: { icon: Ban, cls: "bg-danger-tint text-danger", label: "Blocked" },
  watch: { icon: TrendingDown, cls: "bg-tint text-action", label: "Kart Watch" },
  rules: { icon: SlidersHorizontal, cls: "bg-sunken text-ink", label: "Rules" },
};

export function EventRow({ e, compact, last }: { e: KartEvent; compact?: boolean; last?: boolean }) {
  const m = EVENT_META[e.type] || EVENT_META.decision;
  return (
    <div className="relative flex gap-3">
      {!last && <span className="absolute left-[13px] top-8 bottom-[-12px] w-px bg-line" />}
      <span className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-lg ${m.cls}`}>
        <m.icon size={14} />
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-medium">{m.label}</span>
          {e.amount != null && <span className="text-[12.5px] font-medium tabular-nums text-ink">{usd(e.amount)}</span>}
          <span className="ml-auto text-[11.5px] text-subtle">{ago(e.createdAt)}</span>
        </div>
        {e.rule && <div className="mt-0.5 text-[11.5px] font-medium text-subtle">{e.rule}</div>}
        <p className={`mt-0.5 text-[12.5px] leading-relaxed text-muted ${compact ? "line-clamp-3" : ""}`}>{e.reason}</p>
        {!compact && e.orderId && (
          <Link href={`/orders/${e.orderId}`} className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-action hover:underline">
            <Undo2 size={10} className="rotate-180" /> {e.orderId}
          </Link>
        )}
      </div>
    </div>
  );
}
