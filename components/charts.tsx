"use client";
/**
 * Kart data-viz kit. Specs: 2px lines, 10% area wash, 4px rounded data-ends, 2px surface gaps,
 * hairline solid grid, value-first tooltips, legends for >=2 series, text never in series color.
 */
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- sparkline (stat tile trend) ----------
export function Sparkline({ data, width = 96, height = 32, color = "var(--color-viz-1)" }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const x = (i: number) => 2 + (i / (data.length - 1)) * (width - 6);
  const y = (v: number) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = data.length - 1;
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polygon points={`${x(0)},${height - 2} ${pts} ${x(last)},${height - 2}`} fill={color} opacity={0.1} />
      <polyline points={pts} fill="none" stroke="#b9c3d1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={data.slice(-4).map((v, i) => `${x(last - 3 + i)},${y(v)}`).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(data[last])} r={4} fill={color} stroke="white" strokeWidth={2} />
    </svg>
  );
}

// ---------- area chart with crosshair ----------
function SpendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-pop)]">
      <div className="text-[15px] font-semibold tabular-nums text-ink">{money(payload[0].value)}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
        <span className="h-0.5 w-3 rounded-full bg-viz-1" />
        Net spent by {label}
      </div>
    </div>
  );
}

export function SpendArea({ data }: { data: { d: string; v: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="kart-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0070e0" stopOpacity={0.16} />
            <stop offset="100%" stopColor="#0070e0" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#edf0f4" />
        <XAxis dataKey="d" tick={{ fontSize: 11, fill: "#66728a" }} axisLine={false} tickLine={false} interval={6} tickMargin={8} />
        <YAxis width={46} tick={{ fontSize: 11, fill: "#66728a" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} tickCount={5} />
        <Tooltip content={<SpendTooltip />} cursor={{ stroke: "#9aa6b8", strokeWidth: 1 }} />
        <Area isAnimationActive={false} type="monotone" dataKey="v" stroke="#0070e0" strokeWidth={2} fill="url(#kart-area)" activeDot={{ r: 5, fill: "#0070e0", stroke: "#fff", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------- horizontal bar list (magnitude, one hue) ----------
export function BarList({ items, format = money }: { items: { label: string; value: number; sub?: string; icon?: React.ReactNode }[]; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3" role="list">
      {items.map((it, i) => (
        <li key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="outline-none" aria-label={`${it.label}: ${format(it.value)}`}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
              {it.icon}
              <span className="truncate">{it.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              <b className="font-semibold text-ink">{format(it.value)}</b>
              {it.sub && <span className="ml-1.5">{it.sub}</span>}
            </span>
          </div>
          <div className="h-2.5">
            <div className={`h-full rounded-r-[4px] transition-all duration-500 ${hover === i ? "bg-[#005cc0]" : "bg-viz-1"}`} style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- segmented bar (parts of a whole) + legend ----------
export function SegmentedBar({ parts, format = money }: { parts: { label: string; value: number; color: string }[]; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={parts.map((p) => `${p.label} ${format(p.value)}`).join(", ")}>
        {total === 0 ? (
          <div className="flex-1 rounded-[4px] bg-sunken" />
        ) : (
          shown.map((p) => {
            const idx = parts.indexOf(p);
            return <div key={p.label} onMouseEnter={() => setHover(idx)} onMouseLeave={() => setHover(null)} className="h-full transition-opacity" style={{ width: `${(p.value / total) * 100}%`, background: p.color, opacity: hover === null || hover === idx ? 1 : 0.35 }} title={`${p.label}: ${format(p.value)}`} />;
          })
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {parts.map((p, i) => (
          <li key={p.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={`flex items-center justify-between gap-2 rounded-md text-[12.5px] transition ${hover !== null && hover !== i ? "opacity-50" : ""}`}>
            <span className="flex min-w-0 items-center gap-2 text-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="font-semibold tabular-nums text-ink">{format(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- meter (monthly cap) ----------
export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  const sev = pct >= 90 ? { fill: "bg-danger", track: "bg-danger-tint" } : pct >= 70 ? { fill: "bg-[#d98a1c]", track: "bg-warn-tint" } : { fill: "bg-viz-1", track: "bg-viz-track" };
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex justify-between text-[12px] text-muted">
          <span>{label}</span>
          <span className="tabular-nums">
            <b className="font-semibold text-ink">{money(value)}</b> of {money(max)}
          </span>
        </div>
      )}
      <div className={`h-2 overflow-hidden rounded-full ${sev.track}`} role="meter" aria-valuenow={value} aria-valuemax={max} aria-valuemin={0}>
        <div className={`h-full rounded-full transition-all duration-700 ${sev.fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------- comparison line (this period vs previous) ----------
function CompareTooltip({ active, payload, format }: any) {
  if (!active || !payload?.length) return null;
  const cur = payload.find((p: any) => p.dataKey === "cur");
  const prev = payload.find((p: any) => p.dataKey === "prev");
  return (
    <div className="min-w-[150px] rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-pop)]">
      {cur && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="h-0.5 w-3 rounded-full bg-viz-1" />
            {cur.payload.label}
          </span>
          <b className="text-[13px] tabular-nums text-ink">{format(cur.value)}</b>
        </div>
      )}
      {prev && (
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="h-0.5 w-3 rounded-full bg-[#b9c3d1]" />
            {prev.payload.prevLabel}
          </span>
          <b className="text-[13px] tabular-nums text-muted">{format(prev.value)}</b>
        </div>
      )}
    </div>
  );
}

export function CompareChart({ data, format = money, height = 96, axis = false }: { data: { label: string; prevLabel: string; cur: number; prev: number; x?: string }[]; format?: (n: number) => string; height?: number; axis?: boolean }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: axis ? 0 : 2, right: 6, top: 6, bottom: axis ? 0 : 2 }}>
          {axis && <CartesianGrid vertical={false} stroke="#edf0f4" />}
          {axis ? <XAxis dataKey={data[0]?.x ? "x" : "label"} tick={{ fontSize: 11, fill: "#66728a" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} tickMargin={8} /> : <XAxis dataKey="label" hide />}
          {axis ? <YAxis width={50} tick={{ fontSize: 11, fill: "#66728a" }} axisLine={false} tickLine={false} tickFormatter={(v) => format(v).replace(/\.00$/, "")} tickCount={4} /> : <YAxis hide domain={[0, "auto"]} />}
          <Tooltip content={<CompareTooltip format={format} />} cursor={{ stroke: "#9aa6b8", strokeWidth: 1 }} />
          <Line isAnimationActive={false} type="monotone" dataKey="prev" stroke="#c3cbd6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#b9c3d1", stroke: "#fff", strokeWidth: 2 }} />
          <Line isAnimationActive={false} type="monotone" dataKey="cur" stroke="#0070e0" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: "#0070e0", stroke: "#fff", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
