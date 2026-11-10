"use client";
import { useState } from "react";
import { Ban, Check, RotateCcw } from "lucide-react";
import { PayPalMark } from "../logos";

const AUTO = 30;
const MAX = 50;
const TOP = 75;
const C = { auto: "#12805C", ask: "#D08A12", block: "#C93A26" };
type Zone = keyof typeof C;
const zoneOf = (p: number): Zone => (p <= AUTO ? "auto" : p <= MAX ? "ask" : "block");

/* small flat product drawings */
function Socks() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#EAF6F1" />
      <path d="M17 9h9v17l5 4a5 5 0 0 1-6 8l-9-7a4 4 0 0 1-1.5-3.2V9z" fill="#FFFFFF" stroke="#9FB3A8" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="17" y="9" width="9" height="5" fill="#12805C" />
      <path d="M17 18h9" stroke="#12805C" strokeWidth="2" />
    </svg>
  );
}
function Buds() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#EAF1FC" />
      <path d="M15 14c-6 2-7 11-2 15" fill="none" stroke="#0B5ED7" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="19" cy="26" rx="6" ry="7" fill="#0B1B3F" />
      <path d="M31 16c6 2 7 11 2 15" fill="none" stroke="#0B5ED7" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="29" cy="28" rx="6" ry="7" fill="#0B1B3F" />
    </svg>
  );
}
function Shoe() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#FBEFEC" />
      <path d="M8 31c0-4 1-9 3-13l6 2c2 4 6 6 11 7l9 2c3 .6 4 2 4 4v2H8v-4z" fill="#0B1B3F" />
      <path d="M8 35h33" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M8 35h33v3H8z" fill="#E7E9EF" />
      <path d="M15 22l3 1M17 25l3 1" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const EXAMPLES: { zone: Zone; price: number; item: string; Art: () => React.ReactElement; rule: string; does: string }[] = [
  { zone: "auto", price: 12, item: "Athletic crew socks", Art: Socks, rule: `Up to $${AUTO}`, does: "Kart buys it with your saved PayPal" },
  { zone: "ask", price: 44.99, item: "Sport earbuds", Art: Buds, rule: `$${AUTO} to $${MAX}`, does: "Kart shows the order and waits for your tap" },
  { zone: "block", price: 64, item: "Running shoes", Art: Shoe, rule: `Over $${MAX}`, does: "Kart can't buy it. The server refuses" },
];

const money = (p: number) => (Number.isInteger(p) ? `$${p}` : `$${p.toFixed(2)}`);

export function LimitsDemo() {
  const [price, setPrice] = useState(44.99);
  const zone = zoneOf(price);
  const ex = EXAMPLES.find((e) => e.zone === zone)!;
  const pct = (v: number) => (Math.min(v, TOP) / TOP) * 100;

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
      {/* left: explanation + clickable examples (also the legend) */}
      <div>
        <h2 className="text-balance text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[28px]">You decide where the line is.</h2>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-muted">
          Every shopper sets two numbers: what Kart can buy on its own, and the most it can ever spend on one item. The AI can&apos;t change them.
        </p>
        <p className="mt-6 text-[13px] font-medium text-subtle">Try an example</p>
        <div className="mt-2 space-y-2" role="group" aria-label="Example purchases">
          {EXAMPLES.map((e) => {
            const on = e.zone === zone;
            return (
              <button
                key={e.zone}
                onClick={() => setPrice(e.price)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 text-left transition ${on ? "border-transparent shadow-[0_0_0_2px_var(--z)]" : "border-line hover:border-line-strong"}`}
                style={{ ["--z" as string]: C[e.zone] }}
              >
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px]">
                  <e.Art />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold">{e.item}</span>
                    <span className="text-[14px] font-semibold tabular-nums">{money(e.price)}</span>
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">
                    <span className="mr-1.5 inline-flex items-center gap-1.5 font-medium" style={{ color: C[e.zone] }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: C[e.zone] }} />
                      {e.rule}
                    </span>
                    {e.does}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* right: the slider and the exact result the shopper would see */}
      <div className="rounded-[18px] border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
            <ex.Art />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-muted">If something costs</p>
            <p className="truncate text-[15px] font-semibold">{EXAMPLES.some((e) => e.price === price) ? ex.item : "Anything at this price"}</p>
          </div>
          <output htmlFor="limit-price" className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
            {money(price)}
          </output>
        </div>

        {/* bar */}
        <div className="relative mt-6">
          <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
            <div style={{ width: `${pct(AUTO)}%`, background: C.auto }} />
            <div style={{ width: `${pct(MAX) - pct(AUTO)}%`, background: C.ask }} />
            <div className="flex-1" style={{ background: C.block }} />
          </div>
          <input
            id="limit-price"
            type="range"
            min={1}
            max={TOP}
            step={1}
            value={Math.round(price)}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="rule-range absolute inset-x-0 -top-2 h-7 w-full cursor-pointer appearance-none bg-transparent"
            aria-label="Price of the item"
            aria-valuetext={`${money(price)}: ${ex.does}`}
          />
          <div className="mt-2.5 grid text-[12px]" style={{ gridTemplateColumns: `${pct(AUTO)}% ${pct(MAX) - pct(AUTO)}% 1fr` }} aria-hidden>
            {(["auto", "ask", "block"] as Zone[]).map((z, i) => (
              <div key={z} className={`${i ? "border-l border-line-strong pl-2" : ""}`}>
                <span className={`font-medium ${zone === z ? "" : "text-subtle"}`} style={zone === z ? { color: C[z] } : undefined}>
                  {z === "auto" ? "Kart buys" : z === "ask" ? "Asks you" : "Blocked"}
                </span>
                {i > 0 && <span className="block text-subtle tabular-nums">{money(i === 1 ? AUTO : MAX)}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* outcome: what the shopper actually sees */}
        <div className="mt-6 rounded-xl bg-sunken/70 p-3.5" aria-live="polite">
          <p className="mb-2.5 text-[12px] text-muted">What you&apos;d see in Kart</p>
          {zone === "auto" && (
            <div key="auto" className="agent-in rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full text-white" style={{ background: C.auto }}>
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="text-[13.5px] font-semibold">Bought for you</span>
                <span className="ml-auto text-[13.5px] font-semibold tabular-nums">{money(price)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12.5px] text-muted">
                <span className="flex items-center gap-1">
                  Paid with <PayPalMark size={11} /> your saved PayPal
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-action">
                  <RotateCcw size={12} /> Undo, 10 min
                </span>
              </div>
            </div>
          )}
          {zone === "ask" && (
            <div key="ask" className="agent-in rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center justify-between text-[13.5px]">
                <span className="font-semibold">Confirm your order</span>
                <span className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ color: C.ask, background: "#FBF1DD" }}>
                  Needs your OK
                </span>
              </div>
              <div className="mt-2.5 flex h-9 items-center justify-center rounded-lg bg-[#0B5ED7] text-[13px] font-semibold text-white">Confirm &amp; pay {money(price)}</div>
            </div>
          )}
          {zone === "block" && (
            <div key="block" className="agent-in flex items-start gap-2.5 rounded-lg border bg-surface p-3" style={{ borderColor: "#F1C9C2" }}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: "#FBE7E3", color: C.block }}>
                <Ban size={13} strokeWidth={2.5} />
              </span>
              <div className="text-[12.5px]">
                <p className="text-[13.5px] font-semibold" style={{ color: C.block }}>
                  Blocked by your rules
                </p>
                <p className="mt-0.5 text-muted">{money(price)} is over your {money(MAX)} max per item. No payment was made.</p>
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 text-[12px] text-subtle">Shown with the default limits. Each shopper sets their own and can change them anytime. A monthly cap applies too.</p>
      </div>
    </div>
  );
}
