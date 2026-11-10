"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, Headphones, Footprints, Droplets, Dumbbell, Package, Shirt, Coffee } from "lucide-react";
import type { OrderStatus } from "@/lib/types";
import { Sparkline } from "./charts";
import { Badge as WgBadge } from "@lemonsqueezy/wedges";

// ---------- product image ----------
const ICONS: [RegExp, any, string][] = [
  [/earbud|headphone|earphone|audio|speaker/i, Headphones, "from-[#eef4fe] to-[#dbe8fb]"],
  [/sock|shoe|sneaker/i, Footprints, "from-[#eef8f3] to-[#d7efe3]"],
  [/bottle|flask|tumbler/i, Droplets, "from-[#eef6fb] to-[#d6eaf6]"],
  [/band|mat|rope|dumbbell|yoga|gym/i, Dumbbell, "from-[#fff8ec] to-[#ffeccc]"],
  [/shirt|hoodie|jacket|tee/i, Shirt, "from-[#f4f0fd] to-[#e4dbf8]"],
  [/coffee|dripper|mug/i, Coffee, "from-[#f8f3ee] to-[#ecdfd2]"],
];

export function ProductImage({ src, title, className = "", iconSize = 30 }: { src?: string | null; title: string; className?: string; iconSize?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={title} className={`bg-white object-contain ${className}`} loading="lazy" referrerPolicy="no-referrer" />;
  }
  const [, Icon] = ICONS.find(([re]) => re.test(title)) || [null, Package, "from-[#f2f4f8] to-[#e3e8ef]"];
  return (
    <div className={`grid place-items-center bg-sunken ${className}`}>
      <Icon className="text-navy/60" size={iconSize} strokeWidth={1.4} />
    </div>
  );
}

// ---------- status ----------
const STATUS: Record<OrderStatus, { label: string; cls: string; dot: string }> = {
  created: { label: "Awaiting payment", cls: "bg-sunken text-muted", dot: "bg-subtle" },
  paid: { label: "Paid", cls: "bg-tint text-navy", dot: "bg-action" },
  shipped: { label: "Shipped", cls: "bg-violet-tint text-violet", dot: "bg-violet" },
  delivered: { label: "Delivered", cls: "bg-success-tint text-success", dot: "bg-success" },
  refunded: { label: "Refunded", cls: "bg-warn-tint text-warn", dot: "bg-[#d98a1c]" },
  claim_review: { label: "Claim in review", cls: "bg-danger-tint text-danger", dot: "bg-danger" },
};
export const statusLabel = (s: OrderStatus) => STATUS[s]?.label || s;

const STATUS_COLOR: Record<OrderStatus, "gray" | "blue" | "purple" | "green" | "orange" | "red"> = {
  created: "gray",
  paid: "blue",
  shipped: "purple",
  delivered: "green",
  refunded: "orange",
  claim_review: "red",
};

/** Order status via Wedges Badge (pill, with a status dot). */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status] || STATUS.created;
  return (
    <WgBadge size="sm" shape="pill" color={STATUS_COLOR[status] || "gray"} before={<span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />} className="whitespace-nowrap">
      {s.label}
    </WgBadge>
  );
}

export function Badge({ tone = "neutral", children, className = "" }: { tone?: "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "navy"; children: React.ReactNode; className?: string }) {
  const t = {
    neutral: "bg-sunken text-muted",
    blue: "bg-tint text-action",
    navy: "bg-navy text-white",
    green: "bg-success-tint text-success",
    amber: "bg-warn-tint text-warn",
    red: "bg-danger-tint text-danger",
    violet: "bg-violet-tint text-violet",
  }[tone];
  return <span className={`badge ${t} ${className}`}>{children}</span>;
}

export function Stars({ rating, reviews }: { rating?: number | null; reviews?: number | null }) {
  if (rating == null) return <span className="text-xs text-subtle">No ratings yet</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-muted">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-[#f5a623]">
        <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9z" />
      </svg>
      <b className="font-semibold text-ink">{rating.toFixed(1)}</b>
      {reviews != null && <span className="text-subtle">({reviews.toLocaleString()})</span>}
    </span>
  );
}

export function RiskBar({ score, threshold = 0.3 }: { score: number; threshold?: number }) {
  const pct = Math.min(100, score * 100);
  return (
    <div>
      <div className="relative h-2 rounded-full bg-sunken">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-success to-[#4cc08f]" style={{ width: `${Math.min(pct, threshold * 100)}%` }} />
        {pct > threshold * 100 && <div className="absolute inset-y-0 rounded-r-full bg-danger/80" style={{ left: `${threshold * 100}%`, width: `${pct - threshold * 100}%` }} />}
        <div className="absolute -top-1 h-4 w-px bg-ink/50" style={{ left: `${threshold * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
        <span>0.00</span>
        <span style={{ marginLeft: `${threshold * 100 - 14}%` }}>auto-refund below {threshold.toFixed(2)}</span>
        <span>1.00</span>
      </div>
    </div>
  );
}

// ---------- layout ----------
export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-[-0.015em]">{title}</h1>
        {description && <p className="mt-1 text-[13.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardHeader({ title, icon: Icon, action, sub }: { title: React.ReactNode; icon?: any; action?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
          {Icon && <Icon size={15} className="text-muted" />}
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, tone = "neutral", trend, delta }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: any; tone?: "neutral" | "blue" | "green" | "amber" | "violet"; trend?: number[]; delta?: { text: string; good: boolean } }) {
  const t = { neutral: "bg-sunken text-muted", blue: "bg-tint text-action", green: "bg-success-tint text-success", amber: "bg-warn-tint text-warn", violet: "bg-violet-tint text-violet" }[tone];
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${t}`}>
            <Icon size={15} />
          </span>
        )}
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
            {delta && <span className={`badge ${delta.good ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}>{delta.text}</span>}
            {sub}
          </div>
        </div>
        {trend && trend.length > 1 && <Sparkline data={trend} />}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition ${value === o.value ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.1)]" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: any; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-sunken text-muted">
        <Icon size={18} />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {text && <p className="mt-1 max-w-xs text-xs text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function KV({ k, v, mono }: { k: React.ReactNode; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-[13px]">
      <span className="shrink-0 text-muted">{k}</span>
      <span className={`min-w-0 truncate text-right ${mono ? "font-mono text-[12px]" : "font-medium"}`}>{v}</span>
    </div>
  );
}

// ---------- toasts ----------
type Toast = { id: number; tone: "success" | "error" | "info"; title: string; text?: string };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((xs) => [...xs, { ...t, id }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? AlertCircle : Info;
          const c = t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-action";
          return (
            <div key={t.id} className="anim-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-pop)]">
              <Icon size={17} className={`mt-0.5 shrink-0 ${c}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{t.title}</p>
                {t.text && <p className="mt-0.5 text-xs text-muted">{t.text}</p>}
              </div>
              <button aria-label="Dismiss" className="text-subtle hover:text-ink" onClick={() => setToasts((xs) => xs.filter((x) => x.id !== t.id))}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
