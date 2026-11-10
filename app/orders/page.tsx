"use client";
import { Badge as WgBadge, Button, Kbd, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lemonsqueezy/wedges";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Download, Inbox, Plus, Search, Settings, X } from "lucide-react";
import type { Claim, KartEvent, Order, Rules } from "@/lib/types";
import { api, useApp, usd } from "@/components/app-context";
import { EmptyState, ProductImage, Skeleton, StatusBadge } from "@/components/ui";
import { BarList, CompareChart, Meter } from "@/components/charts";
import { IconAutoBuy, IconGuarantee, IconMoneyBack } from "@/components/icons";
import { PayPalLogo, PayPalMethodChip, StoreLogo, StoreName } from "@/components/logos";
import { EventRow } from "@/components/EventRow";

type Data = { orders: Order[]; events: KartEvent[]; claims: Claim[]; rules: Rules; monthSpent: number };
const credited = (o: Order) => (o.credits || []).reduce((s, c) => s + c.amount, 0);
const net = (o: Order) => o.price - credited(o);
const DAY = 86400000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const PERIODS = { "7d": { days: 7, label: "Last 7 days" }, "4w": { days: 28, label: "Last 4 weeks" }, "3m": { days: 90, label: "Last 3 months" } } as const;
type Period = keyof typeof PERIODS;

const TABS = [
  { key: "all", label: "All", match: () => true },
  { key: "paid", label: "Paid", match: (o: Order) => o.status === "paid" },
  { key: "shipped", label: "Shipped", match: (o: Order) => o.status === "shipped" },
  { key: "delivered", label: "Delivered", match: (o: Order) => o.status === "delivered" },
  { key: "refunded", label: "Paid back", match: (o: Order) => credited(o) > 0 },
  { key: "review", label: "In review", match: (o: Order) => o.status === "claim_review" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const METHODS = { paypal: "PayPal", paylater: "Pay Later", auto: "Auto-buy" } as const;
type Method = keyof typeof METHODS;
const methodOf = (o: Order): Method => (o.buyMode === "auto" ? "auto" : o.fundingSource === "paylater" ? "paylater" : "paypal");

function Delta({ cur, prev, goodWhenUp }: { cur: number; prev: number; goodWhenUp: boolean }) {
  if (!prev && !cur) return null;
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={`badge ${good ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(pct)}%
    </span>
  );
}

function MetricCard({ title, value, prevValue, delta, chart, footer, href }: { title: string; value: string; prevValue: string; delta: React.ReactNode; chart: React.ReactNode; footer?: string; href?: string }) {
  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-center gap-2">
        <h3 className="text-[13.5px] font-medium text-muted">{title}</h3>
        {delta}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
        <span className="text-[12.5px] text-subtle tabular-nums">{prevValue} previous period</span>
      </div>
      <div className="mt-3 flex-1">{chart}</div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[12px] text-subtle">
        <span>{footer || "Updated just now"}</span>
        {href && (
          <Link href={href} className="font-medium text-action hover:underline">
            View more
          </Link>
        )}
      </div>
    </section>
  );
}

function downloadCsv(rows: Order[]) {
  const head = ["id", "date", "amount", "paid_back", "net", "status", "method", "store", "description", "paypal_capture"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((o) => [o.id, o.paidAt || o.createdAt, o.price.toFixed(2), credited(o).toFixed(2), net(o).toFixed(2), o.status, METHODS[methodOf(o)], o.store, o.title, o.paypalCaptureId || ""].map(esc).join(","));
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kart-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Dashboard() {
  const router = useRouter();
  const { status, setRulesOpen } = useApp();
  const [d, setD] = useState<Data | null>(null);
  const [period, setPeriod] = useState<Period>("4w");
  const [tab, setTab] = useState<Tab>("all");
  const [methods, setMethods] = useState<Method[]>([]);
  const [methodMenu, setMethodMenu] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => setD(await api<Data>("/api/orders")), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const paid = useMemo(() => (d ? d.orders.filter((o) => o.paidAt) : []), [d]);

  // ----- Today vs yesterday (hourly, cumulative) -----
  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const t0 = start.getTime();
    const hourNow = new Date().getHours();
    const series: { x: string; label: string; prevLabel: string; cur: number; prev: number }[] = [];
    let c = 0;
    let p = 0;
    for (let h = 0; h < 24; h++) {
      for (const o of paid) {
        const t = new Date(o.paidAt!).getTime();
        if (t >= t0 + h * 3600000 && t < t0 + (h + 1) * 3600000) c += net(o);
        if (t >= t0 - DAY + h * 3600000 && t < t0 - DAY + (h + 1) * 3600000) p += net(o);
      }
      const label = new Date(t0 + h * 3600000).toLocaleTimeString(undefined, { hour: "numeric" });
      series.push({ x: label, label: `Today ${label}`, prevLabel: `Yesterday ${label}`, cur: h <= hourNow ? r2(c) : (undefined as unknown as number), prev: r2(p) });
    }
    return { series, cur: r2(c), prev: r2(p) };
  }, [paid]);

  // ----- Overview metrics: current vs previous period -----
  const ov = useMemo(() => {
    const days = PERIODS[period].days;
    const now = Date.now();
    const buckets = days <= 7 ? days : days <= 28 ? days : Math.ceil(days / 3);
    const step = (days * DAY) / buckets;
    const inWin = (o: Order, a: number, b: number) => {
      const t = new Date(o.paidAt!).getTime();
      return t >= a && t < b;
    };
    const cur = paid.filter((o) => inWin(o, now - days * DAY, now + 1));
    const prev = paid.filter((o) => inWin(o, now - 2 * days * DAY, now - days * DAY));
    const series = (fn: (xs: Order[]) => number, cumulative = true) => {
      const out: { label: string; prevLabel: string; cur: number; prev: number }[] = [];
      let c = 0;
      let p = 0;
      for (let i = 0; i < buckets; i++) {
        const a = now - days * DAY + i * step;
        const b = a + step;
        const cv = fn(paid.filter((o) => inWin(o, a, b)));
        const pv = fn(paid.filter((o) => inWin(o, a - days * DAY, b - days * DAY)));
        c = cumulative ? c + cv : cv;
        p = cumulative ? p + pv : pv;
        out.push({ label: fmtDay(b), prevLabel: fmtDay(b - days * DAY), cur: r2(c), prev: r2(p) });
      }
      return out;
    };
    const sum = (xs: Order[], f: (o: Order) => number) => r2(xs.reduce((s, o) => s + f(o), 0));
    const aov = (xs: Order[]) => (xs.length ? r2(sum(xs, (o) => o.price) / xs.length) : 0);
    const autoShare = (xs: Order[]) => (xs.length ? Math.round((xs.filter((o) => o.buyMode === "auto").length / xs.length) * 100) : 0);
    const byStore = new Map<string, { v: number; n: number }>();
    for (const o of cur) {
      const s = byStore.get(o.store) || { v: 0, n: 0 };
      s.v += net(o);
      s.n++;
      byStore.set(o.store, s);
    }
    return {
      netCur: sum(cur, net),
      netPrev: sum(prev, net),
      netSeries: series((xs) => sum(xs, net)),
      cntCur: cur.length,
      cntPrev: prev.length,
      cntSeries: series((xs) => xs.length),
      backCur: sum(cur, credited),
      backPrev: sum(prev, credited),
      backSeries: series((xs) => sum(xs, credited)),
      aovCur: aov(cur),
      aovPrev: aov(prev),
      autoCur: autoShare(cur),
      autoPrev: autoShare(prev),
      stores: [...byStore.entries()]
        .sort((a, b) => b[1].v - a[1].v)
        .slice(0, 5)
        .map(([label, s]) => ({ label, value: r2(s.v), sub: `${s.n} order${s.n > 1 ? "s" : ""}`, icon: <StoreLogo domain={label} size={20} /> })),
    };
  }, [paid, period]);

  const guarantee = useMemo(() => {
    const all = paid.flatMap((o) => o.credits || []);
    return {
      paidBack: r2(all.reduce((s, c) => s + c.amount, 0)),
      recovering: r2(all.filter((c) => !c.recovered).reduce((s, c) => s + c.amount, 0)),
      recovered: r2(all.filter((c) => c.recovered).reduce((s, c) => s + c.amount, 0)),
      count: all.length,
    };
  }, [paid]);

  const rows = useMemo(() => {
    if (!d) return [];
    const t = TABS.find((x) => x.key === tab)!;
    const s = q.toLowerCase();
    return d.orders.filter((o) => o.status !== "created" && t.match(o) && (!methods.length || methods.includes(methodOf(o))) && (!s || `${o.title} ${o.store} ${o.id} ${o.status} ${o.paypalCaptureId}`.toLowerCase().includes(s)));
  }, [d, tab, methods, q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Sandbox banner, Stripe test-mode style */}
      <div className="h-[3px] shrink-0 bg-[#f5a524]" />
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-5">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[9px] bg-sunken px-3 text-[13px] text-muted focus-within:bg-surface focus-within:ring-2 focus-within:ring-action/25 sm:max-w-[420px]">
          <Search size={15} className="shrink-0 text-subtle" />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders, stores, PayPal IDs" className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle" />
          {q ? (
            <button aria-label="Clear" onClick={() => setQ("")}>
              <X size={14} />
            </button>
          ) : (
            <Kbd keys={["command"]} className="hidden sm:inline-flex">K</Kbd>
          )}
        </label>
        <div className="ml-auto flex items-center gap-1">
          <span className="badge mr-2 hidden bg-[#fff1d6] text-[#8a4b00] sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f5a524]" />
            {status?.paypal ? (status.sandbox ? "Sandbox: test money" : "Live") : "PayPal not set up"}
          </span>
          <Button variant="outline" size="sm" before={<Settings size={14} />} onClick={() => setRulesOpen(true)}>
            Spending rules
          </Button>
        </div>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto bg-surface">
        {!d ? (
          <div className="mx-auto max-w-[1240px] space-y-4 px-8 py-8">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="mx-auto max-w-[1240px] px-5 pb-16 sm:px-8">
            {/* ---------------- Today ---------------- */}
            <div className="flex items-center justify-between pt-8">
              <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Today</h1>
              
            </div>
            <div className="mt-5 grid gap-8 border-b border-line pb-8 lg:grid-cols-[1fr_300px]">
              <div>
                <div className="flex flex-wrap gap-x-10 gap-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-[13px] text-muted">
                      <span className="h-0.5 w-3 rounded-full bg-viz-1" /> Net spend
                    </div>
                    <div className="mt-1 text-[22px] font-semibold tabular-nums">{usd(today.cur)}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-[13px] text-muted">
                      <span className="h-0.5 w-3 rounded-full bg-[#c3cbd6]" /> Yesterday
                    </div>
                    <div className="mt-1 text-[22px] font-semibold tabular-nums text-muted">{usd(today.prev)}</div>
                  </div>
                  <div>
                    <div className="text-[13px] text-muted">Monthly cap</div>
                    <div className="mt-2 w-48">
                      <Meter value={d.monthSpent} max={d.rules.monthlyCap} />
                    </div>
                    <div className="mt-1 text-[12px] text-subtle tabular-nums">
                      {usd(d.monthSpent)} of {usd(d.rules.monthlyCap)}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <CompareChart data={today.series} height={200} axis />
                </div>
              </div>

              <aside className="space-y-6 lg:border-l lg:border-line lg:pl-8">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
                      <IconGuarantee size={16} className="text-success" /> Kart Guarantee
                    </span>
                    <Link href="#activity" className="text-[12px] font-medium text-action hover:underline">
                      View
                    </Link>
                  </div>
                  <div className="mt-1 text-[22px] font-semibold tabular-nums">{usd(guarantee.paidBack)}</div>
                  <div className="text-[12px] text-subtle">paid back to you · {guarantee.count} credit{guarantee.count === 1 ? "" : "s"}</div>
                  <dl className="mt-3 space-y-1.5 text-[13px]">
                    <div className="flex justify-between">
                      <dt className="text-muted">Kart recovering from stores</dt>
                      <dd className="font-medium tabular-nums">{usd(guarantee.recovering)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Recovered</dt>
                      <dd className="font-medium tabular-nums">{usd(guarantee.recovered)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="border-t border-line pt-5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
                      <IconAutoBuy size={16} className="text-[#b56f00]" /> Spending rules
                    </span>
                    <button onClick={() => setRulesOpen(true)} className="text-[12px] font-medium text-action hover:underline">
                      Edit
                    </button>
                  </div>
                  <dl className="mt-2 space-y-1.5 text-[13px]">
                    <div className="flex justify-between">
                      <dt className="text-muted">Kart buys on its own</dt>
                      <dd className="font-medium tabular-nums">≤ ${d.rules.autoBuyUnder}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Asks you first</dt>
                      <dd className="font-medium tabular-nums">≤ ${d.rules.perItemMax}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Agent Mandate</dt>
                      <dd className={`font-medium ${d.rules.mandateActive ? "text-success" : "text-muted"}`}>{d.rules.mandateActive ? "Connected" : "Off"}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex items-center gap-1.5 border-t border-line pt-4 text-[12px] text-subtle">
                  Payments by <PayPalLogo height={14} />
                </div>
              </aside>
            </div>

            {/* ---------------- Overview ---------------- */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-8">
              <h2 className="text-[20px] font-semibold tracking-[-0.015em]">Your overview</h2>
              <div className="flex items-center gap-2 text-[13px]">
                <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                  <SelectTrigger className="h-8 min-w-[150px] text-[13px]" aria-label="Date range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERIODS) as Period[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {PERIODS[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted">compared to</span>
                <WgBadge size="sm">Previous period</WgBadge>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard title="Net spend" value={usd(ov.netCur)} prevValue={usd(ov.netPrev)} delta={<Delta cur={ov.netCur} prev={ov.netPrev} goodWhenUp={false} />} chart={<CompareChart data={ov.netSeries} />} footer="After money paid back" />
              <MetricCard title="Orders" value={String(ov.cntCur)} prevValue={String(ov.cntPrev)} delta={<Delta cur={ov.cntCur} prev={ov.cntPrev} goodWhenUp />} chart={<CompareChart data={ov.cntSeries} format={(n) => String(Math.round(n))} />} href="#payments" />
              <MetricCard title="Paid back by Kart" value={usd(ov.backCur)} prevValue={usd(ov.backPrev)} delta={<Delta cur={ov.backCur} prev={ov.backPrev} goodWhenUp />} chart={<CompareChart data={ov.backSeries} />} footer="Claims, lost items, Price Guard" />
              <section className="card p-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13.5px] font-medium text-muted">Average order</h3>
                  <Delta cur={ov.aovCur} prev={ov.aovPrev} goodWhenUp={false} />
                </div>
                <div className="mt-2 text-[22px] font-semibold tabular-nums">{usd(ov.aovCur)}</div>
                <div className="text-[12.5px] text-subtle">{usd(ov.aovPrev)} previous period</div>
                <div className="mt-5 flex items-center gap-2">
                  <h3 className="text-[13.5px] font-medium text-muted">Bought on its own</h3>
                  <Delta cur={ov.autoCur} prev={ov.autoPrev} goodWhenUp />
                </div>
                <div className="mt-2 text-[22px] font-semibold tabular-nums">{ov.autoCur}%</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-viz-track">
                  <div className="h-full rounded-full bg-viz-1" style={{ width: `${ov.autoCur}%` }} />
                </div>
                <div className="mt-1.5 text-[12px] text-subtle">of orders were auto-buys, all within your rules</div>
              </section>
              <section className="card p-5 xl:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13.5px] font-medium text-muted">Top stores</h3>
                  <span className="text-[12px] text-subtle">Net spend · {PERIODS[period].label.toLowerCase()}</span>
                </div>
                <div className="mt-4">{ov.stores.length ? <BarList items={ov.stores} /> : <p className="text-[13px] text-muted">No orders in this period.</p>}</div>
              </section>
            </div>
            <div className="mt-3 flex items-center gap-4 text-[12px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full bg-viz-1" /> This period
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full bg-[#c3cbd6]" /> Previous period
              </span>
            </div>

            {/* ---------------- Payments ---------------- */}
            <div id="payments" className="flex flex-wrap items-center justify-between gap-3 pt-10">
              <h2 className="text-[20px] font-semibold tracking-[-0.015em]">Payments</h2>
              <Button variant="outline" size="sm"  onClick={() => downloadCsv(rows)} before={<Download size={13} />}>
                Export
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {TABS.map((t) => {
                const n = d.orders.filter((o) => o.status !== "created" && t.match(o)).length;
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-xl border px-3.5 py-2.5 text-left transition ${active ? "border-action bg-tint/40 shadow-[0_0_0_1px_var(--color-action)]" : "border-line hover:border-line-strong"}`}>
                    <div className={`text-[12.5px] ${active ? "font-medium text-action" : "text-muted"}`}>{t.label}</div>
                    <div className="mt-0.5 text-[17px] font-semibold tabular-nums">{n}</div>
                  </button>
                );
              })}
            </div>
            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              <button onClick={() => setMethodMenu((v) => !v)} className={`inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-[12.5px] ${methods.length ? "border-action bg-tint/40 text-action" : "border-line-strong text-muted hover:text-ink"}`}>
                {methods.length ? <X size={12} onClick={(e) => (e.stopPropagation(), setMethods([]))} /> : <Plus size={12} />} Method
                {methods.length > 0 && <b className="ml-0.5 font-semibold">| {methods.map((m) => METHODS[m]).join(", ")}</b>}
              </button>
              {methodMenu && (
                <div className="absolute left-0 top-9 z-20 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]">
                  {(Object.keys(METHODS) as Method[]).map((m) => (
                    <label key={m} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-sunken">
                      <input type="checkbox" className="accent-[#0070E0]" checked={methods.includes(m)} onChange={(e) => setMethods((xs) => (e.target.checked ? [...xs, m] : xs.filter((x) => x !== m)))} />
                      {METHODS[m]}
                    </label>
                  ))}
                </div>
              )}
              {q && (
                <span className="inline-flex h-7 items-center gap-1 rounded-full border border-action bg-tint/40 px-2.5 text-[12.5px] text-action">
                  Search: <b className="font-semibold">{q}</b>
                  <button aria-label="Clear search" onClick={() => setQ("")}>
                    <X size={12} />
                  </button>
                </span>
              )}
              <span className="ml-auto text-[12px] text-subtle">{rows.length} result{rows.length === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              {rows.length ? (
                <table className="w-full min-w-[760px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-muted">
                      <th className="py-2.5 pr-3 font-medium">Amount</th>
                      <th className="px-3 py-2.5 font-medium" />
                      <th className="px-3 py-2.5 font-medium">Payment method</th>
                      <th className="px-3 py-2.5 font-medium">Description</th>
                      <th className="px-3 py-2.5 font-medium">Store</th>
                      <th className="px-3 py-2.5 font-medium">Date</th>
                      <th className="w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => {
                      const back = credited(o);
                      const m = methodOf(o);
                      return (
                        <tr key={o.id} onClick={() => router.push(`/orders/${o.id}`)} className="group cursor-pointer border-b border-line hover:bg-[#f8fafd]">
                          <td className="py-3 pr-3">
                            <span className="font-semibold tabular-nums">{usd(o.price)}</span> <span className="text-[12px] text-subtle">USD</span>
                            {back > 0 && <div className="text-[12px] text-success tabular-nums">−{usd(back)} paid back</div>}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              <PayPalMethodChip />
                              {m === "auto" ? (
                                <span className="inline-flex items-center gap-1">
                                  Saved PayPal <IconAutoBuy size={14} className="text-[#b56f00]" />
                                </span>
                              ) : (
                                METHODS[m]
                              )}
                            </span>
                          </td>
                          <td className="max-w-[280px] px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <ProductImage src={o.image} title={o.title} className="h-7 w-7 shrink-0 rounded-md border border-line" iconSize={13} />
                              <span className="truncate">{o.title}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-muted">
                            <StoreName domain={o.store} size={20} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-muted">{new Date(o.paidAt || o.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                          <td className="text-subtle">
                            <ChevronRight size={15} className="opacity-0 group-hover:opacity-100" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState icon={Inbox} title="No payments match" text="Try another tab or clear the filters." />
              )}
            </div>

            {/* ---------------- Activity ---------------- */}
            <div id="activity" className="grid gap-8 pt-10 lg:grid-cols-[1fr_340px]">
              <section>
                <h2 className="text-[20px] font-semibold tracking-[-0.015em]">Recent activity</h2>
                <p className="mt-1 text-[13px] text-muted">Every decision Kart made, every PayPal event, with the reason.</p>
                <div className="mt-5 space-y-3">
                  {d.events.slice(0, 12).map((e, i, xs) => (
                    <EventRow key={e.id} e={e} last={i === xs.length - 1} />
                  ))}
                </div>
              </section>
              <section className="card h-fit p-5">
                <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                  <IconMoneyBack size={17} className="text-success" /> Kart Guarantee
                </h3>
                <ul className="mt-3 space-y-2.5 text-[13px]">
                  {[
                    ["Damaged or wrong item", "Photo → paid back in seconds"],
                    ["Lost package", "Paid back if it never arrives"],
                    ["Price Guard", "Price drops within 30 days"],
                    ["Undo auto-buy", "Within 10 minutes"],
                  ].map(([a, b]) => (
                    <li key={a} className="flex gap-2">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                      <span>
                        <span className="font-medium">{a}</span>
                        <span className="block text-[12px] text-muted">{b}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
