"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Order } from "@/lib/types";
import { useSession } from "@/components/session";
import { ProductImage, StatusBadge, ago } from "@/components/ui";
import { StoreName } from "@/components/logos";
import { ArrowUpRight, Headphones, Droplets, Footprints } from "lucide-react";
import Composer from "@/components/Composer";
import { api, useApp } from "@/components/app-context";
import { IconAutoBuy, IconDiscover, IconGuarantee, IconPay, IconPriceGuard, IconRules, KartOrb } from "@/components/icons";
import { PayPalLogo } from "@/components/logos";
import { RuleLane } from "@/components/RuleLane";

const SUGGESTIONS = [
  { icon: Headphones, label: "Gym earbuds under $50", text: "Find me wireless earbuds for the gym under $50" },
  { icon: IconAutoBuy, label: "Buy me socks under $20", text: "Buy me athletic crew socks under $20" },
  { icon: Droplets, label: "Best water bottle", text: "Compare insulated water bottles under $40 and pick the best" },
  { icon: IconPriceGuard, label: "Wait for a yoga mat deal", text: "Find a yoga mat and buy it if it drops below $22" },
  { icon: Footprints, label: "Running socks", text: "Find breathable running socks under $25" },
];

const HOW = [
  { icon: IconDiscover, tone: "text-action bg-tint", t: "Finds the best option", d: "Searches thousands of stores via Channel3 and tells you why it picked one." },
  { icon: IconRules, tone: "text-[#b56f00] bg-warn-tint", t: "Buys within your rules", d: "Small things on its own, asks above your limit, never past your max." },
  { icon: IconPay, tone: "text-navy bg-[#e8edf8]", t: "Pays with PayPal", d: "The store is paid straight from your PayPal. Pay Later works too." },
  { icon: IconGuarantee, tone: "text-success bg-success-tint", t: "Kart Guarantee", d: "Damaged, lost or cheaper later? You're paid back in seconds." },
];

export default function ShopHome() {
  const router = useRouter();
  const { rules, monthSpent, setRulesOpen } = useApp();
  const [busy, setBusy] = useState(false);
  const session = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => {
    api<{ orders: Order[] }>("/api/orders")
      .then((r) => setOrders(r.orders.filter((o) => o.status !== "created")))
      .catch(() => setOrders([]));
  }, []);
  const name = session?.name && session.name !== "Demo shopper" ? session.name : rules?.payerName;
  const start = async (text: string, image: string | null) => {
    setBusy(true);
    const { id } = await api<{ id: string }>("/api/chats", {});
    sessionStorage.setItem(`kart-pending-${id}`, JSON.stringify({ text, image }));
    router.push(`/chat/${id}`);
  };
  // Greeting uses the shopper's clock, set after mount so server and browser HTML match.
  const [greet, setGreet] = useState("Hello");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreet(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return (
    <div className="relative flex-1 overflow-y-auto bg-surface">

      <div className="relative mx-auto flex min-h-full max-w-[720px] flex-col px-5 pb-14 pt-[7vh]">
        <div className="mx-auto">
          <KartOrb size={48} />
        </div>
        <p className="mt-6 text-center text-[15px] font-medium text-muted">
          {greet}
          {name ? `, ${name}` : ""}
        </p>
        <h1 className="mt-1 text-center text-[34px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink sm:text-[40px]">What can I buy for you today?</h1>
        <p className="mx-auto mt-3 max-w-[500px] text-center text-[15px] leading-relaxed text-muted">
          I find the best option, pay with PayPal within your rules{rules ? ` (on my own up to $${rules.autoBuyUnder})` : ""}, and if anything goes wrong, you&apos;re paid back instantly.
        </p>

        <div className="relative mt-8">
          <div className="relative">
            <Composer big autoFocus onSend={start} disabled={busy} placeholder="Ask for anything… “wireless earbuds for the gym under $50”" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              disabled={busy}
              onClick={() => start(s.text, null)}
              className="group inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface/90 px-3.5 text-[13px] text-ink shadow-[var(--shadow-xs)] backdrop-blur transition hover:-translate-y-px hover:border-action/40 hover:shadow-[var(--shadow-card)]"
            >
              <s.icon size={15} className="text-muted transition group-hover:text-action" />
              {s.label}
              <ArrowUpRight size={13} className="-ml-0.5 text-subtle opacity-0 transition group-hover:opacity-100" />
            </button>
          ))}
        </div>

        {/* Kart's promise, drawn: where this shopper's money can go, with this month's purchases on it */}
        {rules && (
          <section aria-labelledby="lane" className="mt-10 rounded-[18px] border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="lane" className="text-[15px] font-semibold">
                  Where your money can go
                </h2>
                <p className="mt-0.5 max-w-[52ch] text-[13px] leading-relaxed text-muted">Every purchase lands on this lane. Kart pays in green, asks you in amber, and never goes into red, whichever AI is asking.</p>
              </div>
              <button onClick={() => setRulesOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink hover:border-line-strong">
                <IconRules size={14} /> Change limits
              </button>
            </div>
            <RuleLane
              className="mt-5"
              size="lg"
              rules={rules}
              pins={(orders || [])
                .filter((o) => new Date(o.paidAt || o.createdAt).getMonth() === new Date().getMonth())
                .map((o) => ({ id: o.id, price: o.price, label: o.title }))}
            />
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3.5 text-[12.5px] text-muted">
              <span className="flex min-w-[220px] flex-1 items-center gap-2.5">
                <span className="tabular-nums">
                  <b className="font-semibold text-ink">${monthSpent.toFixed(2)}</b> of ${rules.monthlyCap} this month
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                  <span className="block h-full rounded-full bg-action" style={{ width: `${Math.min(100, (monthSpent / rules.monthlyCap) * 100)}%` }} />
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconGuarantee size={15} className="text-success" /> Paid back first if anything goes wrong
              </span>
              <span className="inline-flex items-center gap-1.5">
                Payments by <PayPalLogo height={14} />
              </span>
            </div>
          </section>
        )}

        {/* your stuff: recent orders, or a short how-to for first-timers */}
        {orders && orders.length > 0 ? (
          <section className="mt-14" aria-labelledby="recent">
            <div className="flex items-baseline justify-between">
              <h2 id="recent" className="text-[15px] font-semibold">
                Your recent orders
              </h2>
              <Link href="/orders" className="text-[13px] font-medium text-action hover:underline">
                See all orders
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[14px] border border-line">
              {orders.slice(0, 3).map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-bg">
                    <ProductImage src={o.image} title={o.title} className="h-10 w-10 shrink-0 rounded-lg border border-line" iconSize={17} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{o.title}</span>
                      <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                        <StoreName domain={o.store} size={13} /> <span>{ago(o.paidAt || o.createdAt)}</span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[14px] font-semibold tabular-nums">${o.price.toFixed(2)}</span>
                      <StatusBadge status={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : orders ? (
          <section className="mt-14" aria-labelledby="how">
            <h2 id="how" className="text-[15px] font-semibold">
              Your first order, in four steps
            </h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-2">
              {HOW.map((f) => (
                <li key={f.t} className="flex gap-3.5 rounded-[14px] border border-line p-4">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${f.tone}`}>
                    <f.icon size={21} />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold">{f.t}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{f.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  );
}
