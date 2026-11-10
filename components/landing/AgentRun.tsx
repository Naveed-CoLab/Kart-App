"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { KartMark } from "../icons";
import { PayPalLogo, PayPalMark, StoreLogo } from "../logos";

/**
 * Hero demo: one Kart purchase from request to money back, on a loop.
 * Everything is derived from one clock, so it can pause (button, off-screen, hidden tab).
 */
const REQUEST = "Wireless earbuds for the gym, under $50";
const STORES = ["target.com", "nike.com", "ebay.com", "etsy.com", "ikea.com", "uniqlo.com", "adidas.com", "apple.com"];

// timeline (ms)
const T = { type: 400, search: 2400, picks: 4800, rules: 6400, confirm: 8800, press: 10400, paid: 11400, later: 12900, done: 14100 };
const END = 18200; // hold on the finished state, then loop
const FADE = 600;
type Phase = keyof typeof T | "idle";
const ORDER: Phase[] = ["idle", "type", "search", "picks", "rules", "confirm", "press", "paid", "later", "done"];

const STATUS: Record<Phase, { text: string; tone: string }> = {
  idle: { text: "Ready", tone: "bg-sunken text-muted" },
  type: { text: "Listening", tone: "bg-sunken text-ink" },
  search: { text: "Searching stores", tone: "bg-tint text-action" },
  picks: { text: "Comparing 3 picks", tone: "bg-tint text-action" },
  rules: { text: "Checking your rules", tone: "bg-warn-tint text-warn" },
  confirm: { text: "Waiting for you", tone: "bg-warn-tint text-warn" },
  press: { text: "Paying with PayPal", tone: "bg-[#e8edf8] text-navy" },
  paid: { text: "Paid", tone: "bg-success-tint text-success" },
  later: { text: "Watching the price", tone: "bg-success-tint text-success" },
  done: { text: "Done", tone: "bg-success-tint text-success" },
};

/* ---------- product illustrations (original, flat) ---------- */
function SportBuds() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#EAF1FC" />
      <path d="M15 14c-6 2-7 11-2 15" fill="none" stroke="#0B5ED7" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="19" cy="26" rx="6" ry="7" fill="#0B1B3F" />
      <circle cx="21" cy="25" r="2.4" fill="#3B4A6B" />
      <path d="M31 16c6 2 7 11 2 15" fill="none" stroke="#0B5ED7" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="29" cy="28" rx="6" ry="7" fill="#0B1B3F" />
      <circle cx="27" cy="27" r="2.4" fill="#3B4A6B" />
    </svg>
  );
}
function OpenBuds() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#EAF6F1" />
      <rect x="11" y="13" width="9" height="22" rx="4.5" fill="#D9DEE7" />
      <rect x="11" y="13" width="9" height="7" rx="3.5" fill="#12805C" />
      <rect x="28" y="15" width="9" height="22" rx="4.5" fill="#D9DEE7" />
      <rect x="28" y="15" width="9" height="7" rx="3.5" fill="#12805C" />
    </svg>
  );
}
function BudgetBuds() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#F1F2F6" />
      <rect x="9" y="20" width="30" height="18" rx="8" fill="#FFFFFF" stroke="#C9CFDA" strokeWidth="1.5" />
      <path d="M9.8 27h28.4" stroke="#C9CFDA" strokeWidth="1.5" />
      <circle cx="24" cy="32" r="1.3" fill="#12805C" />
      <circle cx="18" cy="15" r="4.5" fill="#FFFFFF" stroke="#C9CFDA" strokeWidth="1.5" />
      <rect x="16.6" y="16" width="2.8" height="6" rx="1.4" fill="#FFFFFF" stroke="#C9CFDA" strokeWidth="1.5" />
      <circle cx="30" cy="15" r="4.5" fill="#FFFFFF" stroke="#C9CFDA" strokeWidth="1.5" />
      <rect x="28.6" y="16" width="2.8" height="6" rx="1.4" fill="#FFFFFF" stroke="#C9CFDA" strokeWidth="1.5" />
    </svg>
  );
}

const PICKS = [
  { n: "Sport earbuds with ear hooks", r: "4.6 stars, sweat-proof", p: "$44.99", best: true, Img: SportBuds },
  { n: "Open-ear running buds", r: "4.4 stars, stay put", p: "$39.00", Img: OpenBuds },
  { n: "Budget wireless buds", r: "4.2 stars, 30h battery", p: "$24.95", Img: BudgetBuds },
];
const CHECKS = [
  { t: "$44.99 is under your $50 max per item", ok: true },
  { t: "$82 of your $200 monthly cap used", ok: true },
  { t: "Over your $30 auto-buy limit, so Kart asks you", ok: false },
];

export function AgentRun() {
  const [e, setE] = useState(0); // elapsed ms in the current run
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = box.current;
    const io = el ? new IntersectionObserver(([x]) => setVisible(x.isIntersecting), { threshold: 0.15 }) : null;
    if (el && io) io.observe(el);
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const running = !paused && visible && !reduced;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      setE((v) => (v + dt >= END ? 0 : v + dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const t = reduced ? T.done : e;
  let phase: Phase = "idle";
  for (const p of ORDER.slice(1)) if (t >= T[p as keyof typeof T]) phase = p;
  const at = (p: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(p);
  const typed = Math.max(0, Math.min(REQUEST.length, Math.floor((t - T.type) / 45)));
  const k = Math.max(0, Math.min(1, (t - T.search) / 2000));
  const count = Math.round(1240 * (1 - Math.pow(1 - k, 3)));
  const store = at("picks") ? 0 : Math.floor(Math.max(0, t - T.search) / 120) % STORES.length;
  const fading = !reduced && e > END - FADE;
  const st = STATUS[phase];
  const pressed = at("press");
  const paid = at("paid");
  const working = phase !== "idle" && phase !== "done" && phase !== "confirm";

  return (
    <div ref={box} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} className="rounded-[20px] border border-line bg-surface shadow-[0_24px_60px_-32px_rgba(11,27,63,0.35)]">
      {/* header with live status */}
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <KartMark size={22} thinking={running && working} />
        <span className="text-[13.5px] font-semibold">Kart</span>
        <span aria-live="polite" className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-300 ${st.tone}`}>
          {phase !== "done" && phase !== "idle" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {phase === "done" && <Check size={12} strokeWidth={3} />}
          {st.text}
        </span>
      </div>

      {/* chat viewport: fixed height, newest step at the bottom, older steps scroll up and fade */}
      <div className="relative h-[440px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0,black_44px)] sm:h-[452px]">
      <div className={`absolute inset-x-0 bottom-0 space-y-3 p-4 transition-opacity duration-500 sm:p-5 ${fading ? "opacity-0" : "opacity-100"}`}>
        {/* greeting */}
        <div className="flex max-w-[85%] items-start gap-2.5">
          <KartMark size={24} />
          <div className="rounded-2xl rounded-tl-md bg-sunken px-3.5 py-2 text-[13.5px] text-ink">
            Hi Sam. Tell me what you need and I’ll find it. I stay inside your limits: up to $30 on my own, up to $50 with your OK.
          </div>
        </div>

        {/* request */}
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#0B5ED7] px-3.5 py-2 text-[13.5px] text-white">
          {REQUEST.slice(0, typed) || " "}
          {phase === "type" && typed < REQUEST.length && <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-white" />}
        </div>

        {/* search */}
        {at("search") && (
          <div className="agent-in flex items-center gap-3 text-[13px] text-muted">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface">
              <StoreLogo domain={STORES[store]} size={18} />
            </span>
            <span>
              Searched <b className="font-semibold tabular-nums text-ink">{count.toLocaleString()}</b> stores
              {at("picks") ? " and found 3 good matches" : "…"}
            </span>
          </div>
        )}

        {/* picks with product images */}
        {at("picks") && (
          <div className="space-y-1.5">
            {PICKS.map((x, i) => {
              const best = x.best && at("rules");
              return (
                <div
                  key={x.n}
                  className={`agent-in flex items-center gap-3 rounded-xl border px-2.5 py-2 transition-colors duration-300 ${best ? "border-[#0B5ED7] bg-tint/60" : "border-line"} ${at("rules") && !x.best ? "[&>*]:opacity-55" : ""}`}
                  style={{ animationDelay: `${i * 180}ms` }}
                >
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-[10px]">
                    <x.Img />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{x.n}</p>
                    <p className="text-[11.5px] text-subtle">{x.r}</p>
                  </div>
                  {best && <span className="agent-in rounded-md bg-[#0B5ED7] px-1.5 py-0.5 text-[11px] font-semibold text-white">Best pick</span>}
                  <span className="text-[13px] font-semibold tabular-nums">{x.p}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* rules */}
        {at("rules") && (
          <ul className="space-y-1 rounded-xl bg-sunken/70 px-3.5 py-2.5">
            {CHECKS.map((c, i) => (
              <li key={c.t} className="agent-in flex items-center gap-2 text-[12.5px]" style={{ animationDelay: `${i * 520}ms` }}>
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-white ${c.ok ? "bg-[#12805C]" : "bg-[#E3A33B]"}`}>
                  {c.ok ? <Check size={10} strokeWidth={3.5} /> : <span className="text-[10px] font-bold leading-none">!</span>}
                </span>
                <span className={c.ok ? "text-muted" : "font-medium text-warn"}>{c.t}</span>
              </li>
            ))}
          </ul>
        )}

        {/* confirm */}
        {at("confirm") && (
          <div className="agent-in rounded-xl border border-line p-3">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                <SportBuds />
              </span>
              <div className="min-w-0 flex-1 text-[12.5px]">
                <p className="truncate font-medium text-ink">Sport earbuds with ear hooks</p>
                <p className="flex items-center gap-1 text-muted">
                  Pay with <PayPalMark size={11} /> sam@example.com
                </p>
              </div>
              <span className="text-[13.5px] font-semibold tabular-nums">$44.99</span>
            </div>
            {/* PayPal-style checkout button (gold, PayPal wordmark), as in the real Kart checkout */}
            {paid ? (
              <div className="agent-in mt-2.5 flex h-11 items-center justify-center gap-2 rounded-full bg-success-tint text-[13.5px] font-semibold text-[#12805C]">
                <Check size={15} strokeWidth={3} /> Paid $44.99 to target.com with <PayPalLogo height={14} />
              </div>
            ) : (
              <div
                className={`relative mt-2.5 flex h-11 items-center justify-center gap-1.5 overflow-hidden rounded-full text-[14px] font-semibold text-[#111] transition-all duration-200 ${pressed ? "scale-[0.98] bg-[#F2BA36]" : "bg-[#FFC439]"}`}
              >
                {pressed ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black/70" />
                    <span className="sr-only">Paying with PayPal</span>
                  </>
                ) : (
                  <>
                    Pay <span className="tabular-nums">$44.99</span> with <PayPalLogo height={17} />
                  </>
                )}
                {phase === "confirm" && <span aria-hidden className="agent-tap absolute right-10 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-2 border-black/40" />}
              </div>
            )}
            <p className="mt-2 text-center text-[11.5px] text-muted">
              {paid ? "Store paid directly from your PayPal" : <>Or <b className="font-semibold text-[#003087]">Pay in 4</b> interest-free payments of $11.25</>}
            </p>
          </div>
        )}

        {/* guarantee */}
        {at("later") && (
          <div className="agent-in flex items-start gap-2.5 rounded-xl bg-success-tint px-3.5 py-2.5 text-[12.5px] text-[#0b5e42]">
            <span className="mt-px shrink-0 font-semibold">6 days later</span>
            <span>Price dropped to $39.99. Kart sent $5.00 back to your PayPal.</span>
          </div>
        )}
      </div>
      </div>

    </div>
  );
}
