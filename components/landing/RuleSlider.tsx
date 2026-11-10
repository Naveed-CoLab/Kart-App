"use client";
import { useState } from "react";

const AUTO = 30;
const MAX = 50;
const TOP = 70;

/** Drag a price and see exactly what Kart is allowed to do with it. */
export function RuleSlider() {
  const [price, setPrice] = useState(44);
  const zone = price <= AUTO ? "auto" : price <= MAX ? "ask" : "block";
  const copy = {
    auto: {
      title: "Kart buys it for you",
      body: `$${price} is under your $${AUTO} auto-buy limit, so Kart pays with your saved PayPal and tells you. You can cancel for 10 minutes.`,
      color: "#12805C",
    },
    ask: {
      title: "Kart asks you first",
      body: `$${price} is above $${AUTO}, so Kart shows the order and waits. Nothing is charged until you tap Confirm & pay.`,
      color: "#B56F00",
    },
    block: {
      title: "Kart won't buy it",
      body: `$${price} is over your $${MAX} max per item. The server refuses the payment, even if the AI asks.`,
      color: "#C2341B",
    },
  }[zone];
  const pct = (v: number) => `${(v / TOP) * 100}%`;
  return (
    <div className="rounded-[16px] border border-line bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <label htmlFor="price" className="text-[14px] font-medium">
          Something costs
        </label>
        <output htmlFor="price" className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
          ${price}
        </output>
      </div>

      <div className="relative mt-6">
        <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
          <div className="bg-[#12805C]" style={{ width: pct(AUTO) }} />
          <div className="bg-[#E3A33B]" style={{ width: pct(MAX - AUTO) }} />
          <div className="flex-1 bg-[#E1806C]" />
        </div>
        <input
          id="price"
          type="range"
          min={1}
          max={TOP}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="rule-range absolute inset-x-0 -top-2 h-7 w-full cursor-pointer appearance-none bg-transparent"
          aria-valuetext={`$${price}: ${copy.title}`}
        />
        <div className="relative mt-2 h-5 text-[12.5px] text-muted" aria-hidden>
          <span className="absolute -translate-x-1/2" style={{ left: pct(AUTO) }}>
            ${AUTO}
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: pct(MAX) }}>
            ${MAX}
          </span>
        </div>
      </div>

      <div className="mt-5 border-l-[3px] pl-4" style={{ borderColor: copy.color }} aria-live="polite">
        <p className="text-[15px] font-semibold" style={{ color: copy.color }}>
          {copy.title}
        </p>
        <p className="mt-1 max-w-[52ch] text-[14px] leading-relaxed text-muted">{copy.body}</p>
      </div>
      <p className="mt-5 text-[12.5px] text-subtle">These are the default limits. Each shopper sets their own, and can change them anytime.</p>
    </div>
  );
}
