import Link from "next/link";
import { Bot, Check, Copy, Gauge, KeyRound, Lock, ShieldCheck, Undo2 } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { LimitsDemo } from "@/components/landing/LimitsDemo";
import { AgentRun } from "@/components/landing/AgentRun";
import { MoneyFlow } from "@/components/landing/MoneyFlow";
import { IconClaim, IconDiscover, IconParcel, IconPriceGuard, IconStore, KartMark } from "@/components/icons";
import { ClaudeMark, PayPalLogo, PayPalMark } from "@/components/logos";

export const metadata = {
  title: "Kart: an AI that shops for you and can't overspend",
  description: "Kart finds the best product across thousands of stores, buys within limits you set, pays with your PayPal, and pays you back first if anything goes wrong.",
};


const AFTER = [
  { icon: IconClaim, tint: "#F1EDFC", color: "#5b3cc4", what: "It arrives damaged", how: "Send a photo. Claude checks it against the product.", back: "Back in seconds" },
  { icon: IconParcel, tint: "#EAF1FC", color: "#0B5ED7", what: "It never arrives", how: "Tap “It never arrived” on the order.", back: "Back right away" },
  { icon: IconPriceGuard, tint: "#EAF6F1", color: "#12805C", what: "It gets cheaper", how: "Kart re-checks the price for 30 days.", back: "The difference, automatically" },
  { icon: Undo2, tint: "#FBF1DD", color: "#B56F00", what: "You change your mind", how: "Cancel a one-tap order within 10 minutes.", back: "Full refund" },
];

const PIPE = [
  { t: "Claude suggests", d: "Finds the item and asks to buy it" },
  { t: "You confirm", d: "Or it’s under your auto-buy limit" },
  { t: "Kart checks", d: "Limits, price, your signed OK" },
  { t: "PayPal pays", d: "Straight to the store" },
];

const SAFETY: [string, string, typeof Lock][] = [
  ["Claude can’t spend", "The AI has no tool that moves money. Payments only run on Kart’s server, after these checks.", Bot],
  ["A signed OK for every order", "Your Confirm creates a one-time code for that item at that exact price. It expires in 10 minutes.", KeyRound],
  ["The price is locked", "Kart re-checks the live price before charging and stops if it went up.", Lock],
  ["Limits on every payment", "Max per item, a monthly cap, and a limit on orders per hour.", Gauge],
  ["A second look at odd orders", "Buying the same thing twice, or from a new store, needs a second tap.", Copy],
  ["Your PayPal stays with PayPal", "Kart keeps a PayPal token, never your password or card. Revoke it anytime.", ShieldCheck],
];

const PAYPAL = [
  ["Orders v2 with payee", "The shopper's PayPal pays the store directly"],
  ["Vault", "Connect PayPal once, then one-tap orders"],
  ["JS SDK and Pay Later", "PayPal buttons inside the chat"],
  ["Payouts", "Kart Guarantee money back"],
  ["Refunds", "Cancels and approved claims"],
  ["Agent Toolkit", "Shipment tracking on the payment, order status for Claude"],
  ["Webhooks", "Verified payment, refund and payout events"],
];

function SectionHead({ title, body, light }: { title: string; body?: string; light?: boolean }) {
  return (
    <div className="max-w-[640px]">
      <h2 className={`text-balance text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[28px] ${light ? "text-white" : ""}`}>{title}</h2>
      {body && <p className={`mt-3 text-[15px] leading-relaxed ${light ? "text-white/70" : "text-muted"}`}>{body}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-surface text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
          <Link href="/" aria-label="Kart home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-[14px] text-muted md:flex">
            <a href="#limits" className="hover:text-ink">How it works</a>
            <a href="#after" className="hover:text-ink">Guarantee</a>
            <a href="#stores" className="hover:text-ink">For stores</a>
            <a href="#safety" className="hover:text-ink">Safety</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login?as=store" className="btn-ghost hidden sm:inline-flex">
              Store sign in
            </Link>
            <Link href="/login?as=shopper" className="btn-primary">
              Try Kart
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 pb-16 pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20">
        <div>
          <h1 className={`text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[40px] lg:text-[44px]`}>An AI that shops for you and can’t overspend.</h1>
          <p className="mt-5 max-w-[34rem] text-[16px] leading-relaxed text-muted">
            Tell Kart what you need. It finds the best option across thousands of stores, buys only inside the limits you set, pays with your PayPal, and pays you back first if anything goes wrong.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/login?as=shopper" className="btn-primary btn-lg">
              Try the shopper app
            </Link>
            <Link href="/login?as=store" className="btn-secondary btn-lg">
              <IconStore size={17} /> Open the store dashboard
            </Link>
          </div>
          <div className="mt-9 max-w-[520px]">
            <dl className="grid grid-cols-3 divide-x divide-line rounded-[14px] border border-line">
              {[
                ["#12805C", "Buys on its own", "up to $30"],
                ["#D08A12", "Asks you first", "up to $50"],
                ["#C93A26", "Never spends", "over $50"],
              ].map(([c, t, v]) => (
                <div key={t} className="px-3 py-3 sm:px-4">
                  <dt className="flex items-center gap-1.5 text-[12.5px] text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
                    {t}
                  </dt>
                  <dd className="mt-1 text-[17px] font-semibold tracking-[-0.01em] tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[12.5px] text-subtle">Example limits. Every shopper sets their own.</p>
          </div>
          <p className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
            <span className="flex items-center gap-1.5">
              Payments by <PayPalLogo height={15} />
            </span>
            <span className="flex items-center gap-1.5">
              <ClaudeMark size={15} /> Agent by Claude
            </span>
            <span>Products from Channel3</span>
          </p>
        </div>
        <AgentRun />
      </section>

      {/* the problem, said once */}
      <section className="border-y border-line bg-bg">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 py-10 md:grid-cols-[1fr_1.4fr] md:items-center">
          <p className={`text-balance text-[20px] font-semibold leading-snug tracking-[-0.015em]`}>Agents can already shop. Most people won’t let them.</p>
          <p className="text-[14.5px] leading-relaxed text-muted">
            52% of shoppers aren&apos;t comfortable letting an AI agent buy for them, and losing control of their money is the top fear. Spending limits and easy refunds are what would change their mind. Kart is built around exactly those two things.
            <span className="mt-2 block text-[12.5px] text-subtle">Checkout.com consumer survey on agentic commerce, December 2025</span>
          </p>
        </div>
      </section>

      {/* limits: the interactive centerpiece */}
      <section id="limits" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <LimitsDemo />
      </section>

      {/* guarantee */}
      <section id="after" className="scroll-mt-20 bg-bg">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <SectionHead title="If something goes wrong, Kart pays you first." body="Then Kart sorts it out with the store, so you never chase anyone. Money comes back to the same PayPal you paid with." />
          <div className="mt-8 overflow-hidden rounded-[16px] border border-line bg-surface">
            {AFTER.map((r) => (
              <div key={r.what} className="grid grid-cols-[40px_1fr] gap-x-4 gap-y-1 border-b border-line px-5 py-4 last:border-0 sm:grid-cols-[40px_200px_1fr_210px] sm:items-center sm:gap-x-6">
                <span className="row-span-2 grid h-10 w-10 place-items-center rounded-xl sm:row-span-1" style={{ background: r.tint, color: r.color }}>
                  <r.icon size={20} />
                </span>
                <p className="text-[15px] font-semibold">{r.what}</p>
                <p className="text-[14px] text-muted">{r.how}</p>
                <p className="col-start-2 mt-1 w-fit rounded-full bg-success-tint px-2.5 py-1 text-[12.5px] font-semibold text-[#12805C] sm:col-start-auto sm:mt-0 sm:justify-self-end">{r.back}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* money flow */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead title="Kart never holds your money." body="Your PayPal pays the store directly. Kart only checks the rules before, and protects you after." />
        <MoneyFlow />
        <p className="mt-4 max-w-[60ch] text-[13.5px] text-muted">
          If a refund is due, Kart sends it with PayPal Payouts within seconds, then settles with the store in the store’s dashboard.
        </p>
      </section>

      {/* two sides */}
      <section id="stores" className="scroll-mt-20 border-t border-line bg-bg">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <SectionHead title="One app for shoppers. One dashboard for stores." />
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* shopper */}
            <div className="flex flex-col rounded-[18px] border border-line bg-surface p-6">
              <p className="text-[13px] font-medium text-[#0B5ED7]">For shoppers</p>
              <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.01em]">Ask, confirm, done.</h3>
              <div className="mt-5 rounded-xl bg-bg p-4">
                <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-[#0B5ED7] px-3 py-1.5 text-[13px] text-white">Buy me gym socks under $20</div>
                <div className="mt-3 rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#12805C] text-white">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span className="font-semibold">Bought for you</span>
                    <span className="ml-auto font-semibold tabular-nums">$12.00</span>
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted">Under your $30 auto-buy limit, paid with your saved PayPal. Undo for 10 minutes.</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2 text-[14px]">
                {["Real products from thousands of stores, with reasons", "Limits the AI can’t change", "Money back for damage, loss and price drops"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Check size={17} className="mt-0.5 shrink-0 text-[#0B5ED7]" /> {t}
                  </li>
                ))}
              </ul>
              <Link href="/login?as=shopper" className="btn-primary mt-6 self-start">
                Try the shopper app
              </Link>
            </div>
            {/* store */}
            <div className="flex flex-col rounded-[18px] border border-line bg-surface p-6">
              <p className="text-[13px] font-medium text-violet">For stores</p>
              <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.01em]">Paid orders from AI shoppers.</h3>
              <div className="mt-5 overflow-hidden rounded-xl border border-line">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-bg px-3.5 py-2 text-[11.5px] text-muted">
                  <span>Order</span>
                  <span className="text-right">Sale</span>
                  <span className="w-[108px] text-right">Action</span>
                </div>
                {[
                  { id: "TGT-48291736", item: "Sport earbuds", sale: "$44.99", action: "ship" },
                  { id: "TGT-48290112", item: "Water bottle", sale: "$27.50", action: "done" },
                ].map((o) => (
                  <div key={o.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-line px-3.5 py-2.5 text-[13px]">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{o.item}</span>
                      <span className="text-[11.5px] text-subtle">#{o.id}</span>
                    </span>
                    <span className="text-right font-semibold tabular-nums">{o.sale}</span>
                    <span className="w-[108px] text-right">
                      {o.action === "ship" ? (
                        <span className="inline-block whitespace-nowrap rounded-md bg-[#0B5ED7] px-2 py-1 text-[11.5px] font-semibold text-white">Mark shipped</span>
                      ) : (
                        <span className="text-[12px] text-[#12805C]">Shipped</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <ul className="mt-5 space-y-2 text-[14px]">
                {["Orders arrive already paid into your PayPal", "Add tracking once; it goes on the PayPal payment", "Kart handles shopper issues, so fewer disputes"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Check size={17} className="mt-0.5 shrink-0 text-violet" /> {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href="/login?as=store" className="btn-secondary">
                  Open the store dashboard
                </Link>
                <span className="text-[12.5px] text-subtle">5% fee on orders Kart sends you</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* safety */}
      <section id="safety" className="scroll-mt-20 bg-[#0B1B3F]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <SectionHead light title="The AI can suggest. Only you can spend." body="Claude has no tool that moves money. Every payment goes through the same four steps." />
          <ol className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-4">
            {PIPE.map((s, i) => (
              <li key={s.t} className="relative rounded-xl border border-white/12 bg-white/[0.04] p-4">
                <span className="text-[12px] font-medium text-white/45">Step {i + 1}</span>
                <p className="mt-1 text-[15px] font-semibold text-white">{s.t}</p>
                <p className="mt-1 text-[12.5px] text-white/60">{s.d}</p>
              </li>
            ))}
          </ol>
          <dl className="mt-10 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {SAFETY.map(([t, d, Icon]) => (
              <div key={t as string} className="flex gap-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-[#7DB4FF]">
                  <Icon size={17} />
                </span>
                <div>
                  <dt className="text-[14.5px] font-semibold text-white">{t as string}</dt>
                  <dd className="mt-1 text-[13.5px] leading-relaxed text-white/60">{d as string}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* under the hood */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead title="Built on PayPal and Claude." />
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.35fr]">
          <div className="grid gap-3">
            {[
              { mark: <ClaudeMark size={20} />, t: "Claude", d: "Runs the shopping agent: searches, compares, explains its pick, and checks damage photos." },
              { mark: <PayPalMark size={20} />, t: "PayPal", d: "Moves every dollar: purchases, one-tap orders, refunds and money back." },
              { mark: <IconDiscover size={20} className="text-[#0B5ED7]" />, t: "Channel3", d: "Product search across thousands of stores, with live prices for Price Guard." },
            ].map((x) => (
              <div key={x.t} className="flex gap-3.5 rounded-[14px] border border-line p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg">{x.mark}</span>
                <div>
                  <p className="text-[14.5px] font-semibold">{x.t}</p>
                  <p className="mt-0.5 text-[13.5px] text-muted">{x.d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-[16px] border border-line">
            <div className="flex items-center gap-2 border-b border-line bg-bg px-5 py-3">
              <PayPalLogo height={15} />
              <span className="text-[13px] text-muted">APIs Kart uses</span>
            </div>
            <table className="w-full text-left">
              <tbody>
                {PAYPAL.map(([a, b]) => (
                  <tr key={a} className="border-b border-line last:border-0">
                    <th scope="row" className="whitespace-nowrap px-5 py-2.5 text-[13.5px] font-semibold">
                      {a}
                    </th>
                    <td className="px-5 py-2.5 text-[13.5px] text-muted">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* closing */}
      <section className="px-5 pb-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-[22px] bg-[#0B5ED7] px-6 py-10 text-white sm:px-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <KartMark size={44} tone="light" />
            <div>
              <p className="text-balance text-[24px] font-semibold leading-[1.15] tracking-[-0.02em]">See what Kart would buy for you.</p>
              <p className="mt-1.5 text-[14px] text-white/75">No account needed for the demo. It runs on the PayPal sandbox, so no real money moves.</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/login?as=shopper" className="btn btn-lg bg-white text-[#0B5ED7] hover:bg-white/90">
              Try the shopper app
            </Link>
            <Link href="/login?as=store" className="btn btn-lg border border-white/35 text-white hover:bg-white/10">
              Store dashboard
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-10 text-[13.5px] md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Logo size={24} />
            <p className="mt-3 max-w-[32ch] text-[13px] text-muted">An AI shopping agent with limits you set and a guarantee backed by PayPal.</p>
          </div>
          <nav aria-label="Product">
            <p className="font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-muted">
              <li><a href="#limits" className="hover:text-ink">How it works</a></li>
              <li><a href="#after" className="hover:text-ink">Guarantee</a></li>
              <li><a href="#safety" className="hover:text-ink">Safety</a></li>
            </ul>
          </nav>
          <nav aria-label="Stores">
            <p className="font-semibold">Stores</p>
            <ul className="mt-3 space-y-2 text-muted">
              <li><a href="#stores" className="hover:text-ink">How stores get paid</a></li>
              <li><Link href="/login?as=store" className="hover:text-ink">Store sign in</Link></li>
            </ul>
          </nav>
          <nav aria-label="Try it">
            <p className="font-semibold">Try it</p>
            <ul className="mt-3 space-y-2 text-muted">
              <li><Link href="/login?as=shopper" className="hover:text-ink">Shopper app</Link></li>
              <li><Link href="/login?as=store" className="hover:text-ink">Store dashboard</Link></li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-5 py-4 text-[12px] text-subtle">Built for the PayPal AI Hackathon 2026. Runs on the PayPal sandbox; store checkout is simulated.</p>
        </div>
      </footer>
    </div>
  );
}
