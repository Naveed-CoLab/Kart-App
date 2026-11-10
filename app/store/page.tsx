"use client";
import { Button } from "@lemonsqueezy/wedges";
import { PayPalMark, StoreLogo } from "@/components/logos";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Inbox, Package, Receipt, RotateCcw, ShieldAlert, Store, Truck, Wallet, X } from "lucide-react";
import type { Claim, Order } from "@/lib/types";
import { api, usd, useApp } from "@/components/app-context";
import { useSession } from "@/components/session";
import { AgentBadge } from "@/components/ChatList";
import { Badge, CardHeader, EmptyState, PageHeader, ProductImage, Skeleton, Stat, StatusBadge, useToast } from "@/components/ui";

const credited = (o: Order) => (o.credits || []).reduce((s, c) => s + c.amount, 0);
const toSettle = (o: Order) => (o.credits || []).filter((c) => !c.recovered).reduce((s, c) => s + c.amount, 0);
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null);
const HOW_PAID: Record<Order["buyMode"], string> = {
  auto: "Auto-buy, inside the shopper's limit",
  confirmed: "One tap, confirmed by the shopper",
  popup: "PayPal checkout by the shopper",
};
const CREDIT_KIND: Record<string, string> = { claim: "Damage claim", lost: "Lost package", price_drop: "Price drop", undo: "Cancelled within 10 minutes" };

/** What the store has to do about an order, if anything. */
const needs = (o: Order) => (o.status === "paid" ? "ship" : o.status === "claim_review" ? "claim" : toSettle(o) > 0 ? "settle" : null);

const TABS = [
  { key: "all", label: "All", match: () => true },
  { key: "todo", label: "Needs action", match: (o: Order) => !!needs(o) },
  { key: "transit", label: "Shipped", match: (o: Order) => o.status === "shipped" },
  { key: "done", label: "Delivered", match: (o: Order) => o.status === "delivered" },
  { key: "returns", label: "Claims & returns", match: (o: Order) => o.status === "claim_review" || o.status === "refunded" || credited(o) > 0 },
] as const;

export default function StoreDashboard() {
  const toast = useToast();
  const { status } = useApp();
  const feeRate = status?.feeRate ?? 0.05;
  const session = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const r = await api<{ orders: Order[]; claims: Claim[] }>("/api/orders");
    setOrders(r.orders.filter((o) => o.status !== "created"));
    setClaims(r.claims || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  // The API only returns this store's own orders (signed store session).
  const [info, setInfo] = useState<{ domain: string; demo: boolean; paidTo: string; own: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/stores", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => (r.current ? setInfo(r.current) : router.replace("/store/connect")))
      .catch(() => {});
  }, [router]);
  const demo = info?.demo || session?.store === "demo";
  const current = demo ? "Demo store" : session?.store || "";

  const all = useMemo(() => orders || [], [orders]);
  // Demo view only: the stores these orders belong to, so you can act as one of them.
  const stores = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of all) m.set(o.store, (m.get(o.store) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);
  const [storeFilter, setStoreFilter] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const scoped = useMemo(() => (storeFilter ? all.filter((o) => o.store === storeFilter) : all), [all, storeFilter]);
  const shown = useMemo(() => scoped.filter(TABS.find((t) => t.key === tab)!.match), [scoped, tab]);

  const k = useMemo(() => {
    const sales = scoped.reduce((s, o) => s + o.price, 0);
    const back = scoped.reduce((s, o) => s + credited(o), 0);
    const net = Math.max(0, sales - back);
    return { net, back, fees: net * feeRate, toShip: scoped.filter((o) => o.status === "paid").length, settle: scoped.reduce((s, o) => s + toSettle(o), 0), inReview: scoped.filter((o) => o.status === "claim_review").length };
  }, [scoped, feeRate]);

  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("USPS");
  const [note, setNote] = useState("");
  const act = async (o: Order, url: string, body: unknown, ok: string, text?: string) => {
    setBusy(o.id);
    try {
      await api(url, body);
      toast({ tone: "success", title: ok, text });
      await load();
      return true;
    } catch (e) {
      toast({ tone: "error", title: "That didn't work", text: (e as Error).message });
      return false;
    } finally {
      setBusy("");
    }
  };
  const ship = async (o: Order) => {
    if (await act(o, "/api/paypal/ship", { orderId: o.id, trackingNumber: tracking, carrier }, "Marked as shipped", "Tracking added to the PayPal transaction.")) setTracking("");
  };
  const toggle = (id: string) => {
    setOpen((cur) => (cur === id ? null : id));
    setTracking("");
    setNote("");
  };

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] space-y-6 px-6 py-7">
        <PageHeader
          title="Store dashboard"
          description="Orders from AI shoppers, paid through PayPal the moment they're placed."
          actions={
            <div className="flex items-center gap-2">
              {status?.sandbox && (
                <a href="https://www.sandbox.paypal.com/activities" target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                  <PayPalMark size={13} /> See payments in PayPal sandbox
                </a>
              )}
              <Link href="/store/connect" className="btn-ghost btn-sm">
                Store settings
              </Link>
            </div>
          }
        />

        {!orders ? (
          <div className="grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
        ) : (
          <>
            {demo ? (
              <div className="rounded-xl border border-violet/20 bg-violet-tint px-4 py-3.5 text-[13px] leading-relaxed text-[#3d2a8a]">
                <p>
                  <b className="font-semibold">Demo view: you're the store for every order you placed.</b> Your orders came from {stores.length || "no"} {stores.length === 1 ? "store" : "stores"}. A real store that joins Kart sees only its own orders; here you can act as each of them to try shipping, claims and returns.
                </p>
                {stores.length > 1 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => setStoreFilter(null)} aria-pressed={!storeFilter} className={`rounded-full border px-2.5 py-1 text-[12px] font-medium ${!storeFilter ? "border-violet bg-violet text-white" : "border-violet/25 bg-white/70 text-[#3d2a8a] hover:bg-white"}`}>
                      All stores · {all.length}
                    </button>
                    {stores.map(([d, n]) => (
                      <button key={d} type="button" onClick={() => setStoreFilter(storeFilter === d ? null : d)} aria-pressed={storeFilter === d} className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2.5 text-[12px] font-medium ${storeFilter === d ? "border-violet bg-violet text-white" : "border-violet/25 bg-white/70 text-[#3d2a8a] hover:bg-white"}`}>
                        <StoreLogo domain={d} size={16} /> {d} · {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card flex flex-wrap items-center gap-4 px-5 py-4">
                <StoreLogo domain={current} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{current}</span>
                    {info?.own ? (
                      <Badge tone="green">
                        <Check size={11} /> PayPal connected
                      </Badge>
                    ) : (
                      <Badge tone="neutral">{status?.paypal ? "Paid via Kart's sandbox store" : "PayPal not set up"}</Badge>
                    )}
                  </div>
                  <p className="text-[12.5px] text-muted">
                    {!info ? (
                      "Loading…"
                    ) : !status?.paypal ? (
                      "PayPal isn't set up on Kart yet, so no payments can be taken."
                    ) : (
                      <>
                        Payments go to <b className="font-medium text-ink">{info.paidTo}</b> the moment a shopper pays. Kart handles shopper issues and settles returns with you.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Net sales via Kart" value={usd(k.net)} sub={`${scoped.length} order${scoped.length === 1 ? "" : "s"}, after money back`} icon={Receipt} tone="blue" />
              <Stat label="To ship" value={k.toShip} sub={k.inReview ? `${k.inReview} claim${k.inReview === 1 ? "" : "s"} to review` : "Paid, waiting for tracking"} icon={Package} tone="amber" />
              <Stat label={`Kart fee (${Math.round(feeRate * 1000) / 10}%)`} value={usd(k.fees)} sub="On net sales, invoiced monthly" icon={Wallet} />
              <Stat label="Paid back to shoppers" value={usd(k.back)} sub={k.settle > 0 ? `${usd(k.settle)} to settle with Kart` : "All settled"} icon={RotateCcw} tone="violet" />
            </div>

            <div className="space-y-5">
              <section className="card overflow-hidden">
                <CardHeader title={storeFilter ? `Orders for ${storeFilter}` : "Orders"} icon={Receipt} />
                <div className="flex flex-wrap gap-1.5 border-b border-line px-5 pb-3" role="tablist" aria-label="Filter orders">
                  {TABS.map((t) => {
                    const n = scoped.filter(t.match).length;
                    return (
                      <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${tab === t.key ? "bg-ink text-white" : "bg-sunken text-muted hover:text-ink"}`}>
                        {t.label}
                        <span className={`ml-1.5 tabular-nums ${tab === t.key ? "text-white/70" : "text-subtle"}`}>{n}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[13px]">
                    <thead>
                      <tr className="bg-sunken/60 text-left text-[11.5px] text-muted">
                        <th className="px-5 py-2 font-medium">Order</th>
                        <th className="px-3 py-2 font-medium">{demo ? "Store" : "Ordered by"}</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Sale</th>
                        <th className="px-5 py-2 text-right font-medium">Next step</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!shown.length && (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState
                              icon={Inbox}
                              title={all.length ? "Nothing here" : "No orders from Kart shoppers yet"}
                              text={all.length ? "No orders match this filter." : demo ? "Switch to the shopper side, buy something, then come back here to ship it." : "When a shopper buys from your store through Kart, the order shows up here, already paid with PayPal."}
                            />
                          </td>
                        </tr>
                      )}
                      {shown.map((o) => {
                        const need = needs(o);
                        const isOpen = open === o.id;
                        const claim = claims.find((c) => c.orderId === o.id);
                        const fee = Math.max(0, o.price - credited(o)) * feeRate;
                        return (
                          <Fragment key={o.id}>
                            <tr className={`border-t border-line ${isOpen ? "bg-sunken/40" : "hover:bg-sunken/30"}`}>
                              <td className="px-5 py-3">
                                <button type="button" onClick={() => toggle(o.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 text-left">
                                  <ProductImage src={o.image} title={o.title} className="h-9 w-9 shrink-0 rounded-lg border border-line" iconSize={15} />
                                  <span className="min-w-0">
                                    <span className="block max-w-[340px] truncate font-medium">{o.title}</span>
                                    <span className="text-[11.5px] text-subtle">{when(o.paidAt || o.createdAt)}</span>
                                  </span>
                                </button>
                              </td>
                              <td className="px-3 py-3">
                                {demo ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <StoreLogo domain={o.store} size={18} />
                                    <span className="max-w-[200px] truncate">{o.store}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-muted">
                                    <AgentBadge agent={o.agent || "Kart chat"} /> {o.agent || "Kart chat"}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <StatusBadge status={o.status} />
                              </td>
                              <td className="px-3 py-3 text-right font-medium tabular-nums">{usd(o.price)}</td>
                              <td className="px-5 py-3 text-right">
                                <button type="button" onClick={() => toggle(o.id)} aria-expanded={isOpen} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium ${need ? "bg-action text-white hover:bg-action/90" : "text-muted hover:bg-sunken hover:text-ink"}`}>
                                  {need === "ship" ? (
                                    <>
                                      <Truck size={13} /> Ship
                                    </>
                                  ) : need === "claim" ? (
                                    <>
                                      <ShieldAlert size={13} /> Review claim
                                    </>
                                  ) : need === "settle" ? (
                                    <>
                                      <RotateCcw size={13} /> Settle {usd(toSettle(o))}
                                    </>
                                  ) : (
                                    "Details"
                                  )}
                                  <ChevronDown size={13} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                </button>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-t border-line bg-sunken/40">
                                <td colSpan={5} className="px-5 pb-5 pt-1">
                                  <div className="grid gap-4 md:grid-cols-3">
                                    <Block title="Payment">
                                      <Row k="PayPal transaction" v={o.paypalCaptureId ? <span className="font-mono text-[12px]">{o.paypalCaptureId}</span> : "—"} />
                                      <Row k="Paid to" v={o.merchant === "store" ? "This store's PayPal, directly" : "Kart's sandbox store account"} />
                                      <Row k={`Kart fee (${Math.round(feeRate * 1000) / 10}%)`} v={usd(fee)} />
                                      <Row k="Store receives" v={<b className="font-semibold">{usd(Math.max(0, o.price - credited(o)) - fee)}</b>} />
                                    </Block>
                                    <Block title="Order">
                                      <Row
                                        k="Ordered by"
                                        v={
                                          <span className="inline-flex items-center gap-1.5">
                                            <AgentBadge agent={o.agent || "Kart chat"} /> {o.agent || "Kart chat"}
                                          </span>
                                        }
                                      />
                                      <Row k="How" v={HOW_PAID[o.buyMode]} />
                                      <Row k="Ship to" v="Shopper's PayPal address" />
                                      <Row k="Order ID" v={<span className="font-mono text-[12px]">{o.storeOrder ? `#${o.storeOrder.number}` : o.id}</span>} />
                                    </Block>
                                    <Block title="Timeline">
                                      <Step done label="Paid" at={when(o.paidAt || o.createdAt)} />
                                      <Step done={!!o.shippedAt} label={o.trackingNumber ? `Shipped · ${o.carrier || "USPS"} ${o.trackingNumber}` : "Shipped"} at={when(o.shippedAt)} />
                                      <Step done={!!o.deliveredAt} label="Delivered" at={when(o.deliveredAt)} />
                                      {(o.credits || []).map((c) => (
                                        <Step key={c.id} done tone="violet" label={`${usd(c.amount)} back to the shopper · ${CREDIT_KIND[c.kind] || c.kind}${c.recovered ? " · settled" : ""}`} at={when(c.at)} />
                                      ))}
                                    </Block>
                                  </div>

                                  {claim && (
                                    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <ShieldAlert size={15} className={o.status === "claim_review" ? "text-danger" : "text-muted"} />
                                        <span className="text-[13.5px] font-semibold">Damage claim</span>
                                        <Badge tone={o.status === "claim_review" ? "red" : claim.decision === "auto_refund" ? "green" : "neutral"}>{o.status === "claim_review" ? "Waiting for your review" : claim.decision === "auto_refund" ? "Paid back automatically" : "Reviewed"}</Badge>
                                        <span className="text-[11.5px] text-subtle">{when(claim.createdAt)}</span>
                                      </div>
                                      <dl className="mt-3 grid gap-x-6 gap-y-2 text-[12.5px] md:grid-cols-2">
                                        <div>
                                          <dt className="text-subtle">Shopper said</dt>
                                          <dd className="mt-0.5">"{claim.reason}"</dd>
                                        </div>
                                        <div>
                                          <dt className="text-subtle">Claude's photo check</dt>
                                          <dd className="mt-0.5">
                                            {claim.vision.summary}{" "}
                                            <span className="text-muted">
                                              ({claim.vision.damage_visible ? "damage visible" : "no damage visible"}, {claim.vision.matches_product ? "matches the product" : "doesn't match the product"}, {Math.round(claim.vision.confidence * 100)}% sure)
                                            </span>
                                          </dd>
                                        </div>
                                        <div className="md:col-span-2">
                                          <dt className="text-subtle">Risk check</dt>
                                          <dd className="mt-0.5">{claim.reasons.length ? claim.reasons.join(" · ") : "No risk signals."}</dd>
                                        </div>
                                      </dl>
                                      {o.status === "claim_review" && (
                                        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
                                          <Button variant="primary" size="sm" disabled={busy === o.id} onClick={() => act(o, "/api/guarantee", { orderId: o.id, action: "approve_claim" }, "Claim approved", "Kart paid the shopper back through PayPal.")} before={<Check size={13} />}>
                                            Approve and pay back {usd(Math.max(0, o.price - credited(o)))}
                                          </Button>
                                          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Reason, if you decline (shown to the shopper)" aria-label="Reason for declining" className="h-8 min-w-[220px] flex-1 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] outline-none focus:border-action" />
                                          <Button variant="outline" size="sm" disabled={busy === o.id} onClick={() => act(o, "/api/guarantee", { orderId: o.id, action: "decline_claim", note }, "Claim declined", "No money moved. The shopper was told why.")} before={<X size={13} />}>
                                            Decline
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {need === "ship" && (
                                    <form
                                      className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-4"
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        ship(o);
                                      }}
                                    >
                                      <Truck size={15} className="text-action" />
                                      <span className="mr-1 text-[13.5px] font-semibold">Ship this order</span>
                                      <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px]" aria-label="Carrier">
                                        {["USPS", "UPS", "FedEx", "DHL"].map((c) => (
                                          <option key={c}>{c}</option>
                                        ))}
                                      </select>
                                      <input autoFocus value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" aria-label="Tracking number" className="h-8 min-w-[180px] flex-1 rounded-lg border border-line px-2.5 text-[12.5px] outline-none focus:border-action" />
                                      <Button type="submit" variant="primary" size="sm" disabled={busy === o.id || !tracking.trim()}>
                                        {busy === o.id ? "Saving…" : "Mark shipped"}
                                      </Button>
                                      <span className="basis-full text-[11.5px] text-subtle">The tracking number is added to the PayPal transaction, and the shopper is told it's on the way.</span>
                                    </form>
                                  )}

                                  {need === "settle" && (
                                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
                                      <RotateCcw size={15} className="text-violet" />
                                      <span className="min-w-0 flex-1 text-[12.5px]">
                                        <b className="block text-[13.5px] font-semibold">Settle {usd(toSettle(o))} with Kart</b>
                                        <span className="text-muted">Kart already paid the shopper back. Settling confirms the store covers it (by return or adjustment).</span>
                                      </span>
                                      <Button variant="primary" size="sm" disabled={busy === o.id} onClick={() => act(o, "/api/guarantee", { orderId: o.id, action: "recover" }, "Settled with Kart")}>
                                        Settle {usd(toSettle(o))}
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card p-5">
                <h3 className="text-[14px] font-semibold">How Kart works for a store</h3>
                <ul className="mt-3 grid gap-x-6 gap-y-2.5 text-[12.5px] sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Paid when the order is placed", "The shopper's PayPal pays the store. A store that connected its own PayPal is paid directly."],
                    ["You ship and add tracking", "Kart adds the tracking number to the PayPal transaction and tells the shopper."],
                    ["Kart handles the shopper", "Damage, lost packages and price drops are paid back by Kart first. You review doubtful claims and settle here."],
                    [`${Math.round(feeRate * 1000) / 10}% Kart fee`, "Only on orders Kart sends you, after money back, invoiced monthly."],
                  ].map(([a, b]) => (
                    <li key={a} className="flex gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-success" />
                      <span>
                        <span className="font-medium">{a}</span>
                        <span className="block text-muted">{b}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {demo && (
                  <Link href="/store/connect" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[12.5px] font-medium hover:bg-sunken">
                    <Store size={14} className="text-violet" /> Own a store? Claim your domain and connect PayPal
                  </Link>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h4 className="text-[12px] font-semibold text-muted">{title}</h4>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="shrink-0 text-subtle">{k}</span>
      <span className="min-w-0 text-right">{v}</span>
    </div>
  );
}

function Step({ done, label, at, tone }: { done: boolean; label: string; at?: string | null; tone?: "violet" }) {
  return (
    <div className="flex items-start gap-2 text-[12.5px]">
      <span className={`mt-[3px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${done ? (tone === "violet" ? "bg-violet text-white" : "bg-success text-white") : "border border-line bg-surface"}`}>{done && <Check size={9} strokeWidth={3} />}</span>
      <span className={`min-w-0 flex-1 ${done ? "" : "text-subtle"}`}>{label}</span>
      {at && <span className="shrink-0 text-[11.5px] text-subtle">{at}</span>}
    </div>
  );
}
