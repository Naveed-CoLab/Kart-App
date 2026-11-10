"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { KartMark, IconStore } from "../icons";
import { PayPalMark } from "../logos";

/**
 * How the money moves, as a short loop:
 * PayPal → Kart (checks) → store, then money back from Kart → PayPal.
 * Driven by one clock; pauses off-screen; static for reduced motion.
 */
const S = { start: 300, toKart: 900, checks: 1700, toStore: 3000, storePaid: 3700, back: 5000, backDone: 5900 };
const MOVE = 700;
const BACK = 900;
const END = 9000;
const CHECKS = ["Your limits", "The price", "Your OK"];

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

export function MoneyFlow() {
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      setT((v) => (v + dt >= END ? 0 : v + dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, reduced]);

  const now = reduced ? S.backDone + 100 : t;
  const p1 = ease(clamp((now - S.toKart) / MOVE)); // PayPal → Kart
  const p2 = ease(clamp((now - S.toStore) / MOVE)); // Kart → store
  const pb = ease(clamp((now - S.back) / BACK)); // Kart → PayPal (money back)
  const checksDone = Math.max(0, Math.min(3, Math.floor((now - S.checks) / 380) + 1));
  const storePaid = now >= S.storePaid;
  const backDone = now >= S.backDone;
  const fading = !reduced && t > END - 500;

  const active = now < S.toKart + MOVE ? 0 : now < S.toStore ? 1 : now < S.storePaid ? 2 : now < S.back ? 2 : now < S.backDone ? 1 : 0;
  const ring = (i: number) => (active === i && now > S.start ? "border-[#0B5ED7] shadow-[0_0_0_3px_rgba(11,94,215,0.12)]" : "border-line");

  const Chip = ({ green, label }: { green?: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-white shadow-[0_2px_6px_rgba(11,27,63,0.25)] ${green ? "bg-[#12805C]" : "bg-[#0B5ED7]"}`}>{label}</span>
  );

  /** A connector between two cards: horizontal on desktop, vertical on phones. */
  const Link = ({ progress, label, showChip, back }: { progress: number; label: string; showChip: boolean; back?: { progress: number; show: boolean } }) => (
    <div className="relative flex items-center justify-center md:w-36">
      {/* phone: vertical */}
      <div className="relative h-14 w-[3px] rounded-full bg-line md:hidden">
        <div className="absolute inset-x-0 top-0 rounded-full bg-[#0B5ED7]" style={{ height: `${progress * 100}%` }} />
        {showChip && (
          <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: `${progress * 100}%` }}>
            <Chip label="$44.99" />
          </span>
        )}
        <span className="absolute left-12 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11.5px] font-medium text-[#0B5ED7]">{label}</span>
      </div>
      {/* desktop: horizontal */}
      <div className="hidden w-full md:block">
        <p className="mb-2 text-center text-[11.5px] font-medium text-[#0B5ED7]">{label}</p>
        <div className="relative h-[3px] rounded-full bg-line">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#0B5ED7]" style={{ width: `${progress * 100}%` }} />
          {showChip && (
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${progress * 100}%` }}>
              <Chip label="$44.99" />
            </span>
          )}
        </div>
        {back && (
          <>
            <div className="relative mt-5 h-[3px] rounded-full bg-line">
              <div className="absolute inset-y-0 right-0 rounded-full bg-[#12805C]" style={{ width: `${back.progress * 100}%` }} />
              {back.show && (
                <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(1 - back.progress) * 100}%` }}>
                  <Chip green label="$5.00" />
                </span>
              )}
            </div>
            <p className="mt-2 text-center text-[11.5px] font-medium text-[#12805C]">Money back if needed</p>
          </>
        )}
        {!back && <div aria-hidden className="h-[44px]" />}
      </div>
    </div>
  );

  return (
    <div ref={box} className={`mt-8 grid grid-cols-1 items-stretch gap-3 transition-opacity duration-500 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-2 ${fading ? "opacity-40" : "opacity-100"}`}>
      {/* your PayPal */}
      <div className={`flex flex-col rounded-[16px] border bg-surface p-5 transition-[border-color,box-shadow] duration-300 ${ring(0)}`}>
        <span className="flex h-[30px] items-center self-start">
          <PayPalMark size={26} />
        </span>
        <p className="mt-3 text-[15px] font-semibold">Your PayPal</p>
        <p className="mt-1 text-[13.5px] text-muted">You tap Confirm &amp; pay</p>
        <div className="mt-auto pt-4">
          {backDone ? (
            <p key="back" className="agent-in flex items-center gap-1.5 text-[13px] font-semibold text-[#12805C]">
              <Check size={14} strokeWidth={3} /> $5.00 back from Kart
            </p>
          ) : (
            <p className="text-[13px] text-subtle">{now > S.toKart ? "Sent $44.99" : "Ready to pay $44.99"}</p>
          )}
        </div>
      </div>

      <Link progress={p1} label="Rules checked" showChip={now > S.toKart && p1 < 1} back={{ progress: pb, show: now > S.back && pb < 1 }} />

      {/* Kart */}
      <div className={`flex flex-col rounded-[16px] border bg-surface p-5 transition-[border-color,box-shadow] duration-300 ${ring(1)}`}>
        <span className="flex h-[30px] items-center self-start">
          <KartMark size={30} />
        </span>
        <p className="mt-3 text-[15px] font-semibold">Kart</p>
        <p className="mt-1 text-[13.5px] text-muted">Checks before money moves</p>
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {CHECKS.map((c, i) => {
            const ok = now >= S.checks && i < checksDone;
            return (
              <li key={c} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium transition-colors duration-300 ${ok ? "bg-success-tint text-[#12805C]" : "bg-sunken text-subtle"}`}>
                {ok && <Check size={11} strokeWidth={3} />}
                {c}
              </li>
            );
          })}
        </ul>
      </div>

      <Link progress={p2} label="Paid directly" showChip={now > S.toStore && p2 < 1} />

      {/* store */}
      <div className={`flex flex-col rounded-[16px] border bg-surface p-5 transition-[border-color,box-shadow] duration-300 ${ring(2)}`}>
        <span className="flex h-[30px] items-center self-start">
          <IconStore size={26} className="text-violet" />
        </span>
        <p className="mt-3 text-[15px] font-semibold">The store</p>
        <p className="mt-1 text-[13.5px] text-muted">Ships the order and adds tracking</p>
        <div className="mt-auto pt-4">
          {storePaid ? (
            <p key="paid" className="agent-in flex items-center gap-1.5 text-[13px] font-semibold text-[#12805C]">
              <Check size={14} strokeWidth={3} /> Paid $44.99
            </p>
          ) : (
            <p className="text-[13px] text-subtle">Waiting for payment</p>
          )}
        </div>
      </div>
    </div>
  );
}
