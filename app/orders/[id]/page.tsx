"use client";
import { StoreCheckout } from "@/components/StoreCheckout";
import { Button } from "@lemonsqueezy/wedges";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronRight, CreditCard, PackageCheck, PackageX, Store, TrendingDown, Truck, ShoppingBag } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import type { Claim, KartEvent, Order, Product } from "@/lib/types";
import { api, usd, useApp } from "@/components/app-context";
import { Badge, CardHeader, KV, ProductImage, Skeleton, StatusBadge, useToast } from "@/components/ui";
import { ClaimCard } from "@/components/ChatCards";
import { EventRow } from "@/components/EventRow";
import { PayPalLogo, StoreName } from "@/components/logos";
import { IconAutoBuy, IconClaim, IconGuarantee, IconMoneyBack, IconParcel, IconPay, IconPriceGuard } from "@/components/icons";

type Data = { order: Order; events: KartEvent[]; claims: Claim[]; product: Product | null };

async function fileToDataUrl(f: File) {
  return new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(f);
  });
}
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null);
const credited = (o: Order) => (o.credits || []).reduce((s, c) => s + c.amount, 0);

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { refreshRules, status } = useApp();
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => setD(await api<Data>(`/api/orders/${id}`)), [id]);
  useEffect(() => {
    load().catch((e) => toast({ tone: "error", title: "Couldn't load order", text: e.message }));
  }, [load, toast]);

  const act = async (label: string, url: string, body: unknown, success?: string) => {
    setBusy(label);
    try {
      await api(url, body);
      await load();
      refreshRules();
      if (success) toast({ tone: "success", title: success });
    } catch (e) {
      toast({ tone: "error", title: "Action failed", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const priceCheck = async () => {
    setBusy("price");
    try {
      const r = await api<{ changed: boolean; price: number; diff: number }>(`/api/orders/${id}/action`, { action: "price_check" });
      toast(r.changed ? { tone: "success", title: `Price dropped: Kart paid you ${usd(r.diff)}`, text: `Now ${usd(r.price)}.` } : { tone: "info", title: "No price drop yet", text: `Still ${usd(r.price)}. Kart keeps watching for 30 days.` });
      await load();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't check the price", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  if (!d)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-6 py-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );

  const o = d.order;
  const back = credited(o);
  const live = ["paid", "shipped", "delivered"].includes(o.status);
  const withinDays = (n: number) => Date.now() - new Date(o.paidAt || o.createdAt).getTime() < n * 86400000;
  const steps = [
    { icon: CreditCard, title: "Paid with PayPal", at: o.paidAt, sub: o.buyMode === "auto" ? "Auto-buy with your saved PayPal" : o.buyMode === "confirmed" ? "You confirmed · saved PayPal, no popup" : o.fundingSource === "paylater" ? "PayPal Pay Later" : "Approved by you" },
    { icon: Store, title: `${o.store} paid`, at: o.paidAt, sub: o.merchant === "store" ? "Directly from your PayPal" : `Instantly via PayPal Payouts${o.storePayoutBatchId ? ` · ${o.storePayoutBatchId}` : ""}` },
    { icon: ShoppingBag, title: o.storeOrder ? `Order placed on ${o.store} · #${o.storeOrder.number}` : "Order placed with the store", at: o.storeOrder?.placedAt, sub: o.storeOrder ? (o.storeOrder.mode === "demo" ? "Kart's checkout agent (sandbox demo)" : "Kart's checkout agent") : "Waiting" },
    { icon: Truck, title: "Shipped", at: o.shippedAt, sub: o.trackingNumber ? `USPS ${o.trackingNumber} · tracking added to PayPal` : "Waiting for the store" },
    { icon: PackageCheck, title: "Delivered", at: o.deliveredAt, sub: o.deliveredAt ? "Covered by Kart Guarantee for 30 days" : "Not yet" },
  ];
  const coverage = [
    { icon: IconClaim, t: "Damaged or wrong item", d: "Photo → refund in seconds", kind: "claim", active: live && withinDays(30) },
    { icon: IconParcel, t: "Lost package", d: "Refund if it never arrives", kind: "lost", active: o.status === "paid" || o.status === "shipped" },
    { icon: IconPriceGuard, t: "Price Guard", d: "Price drops within 30 days", kind: "price_drop", active: live && withinDays(30) },
    ...(o.buyMode !== "popup" ? [{ icon: IconAutoBuy, t: o.buyMode === "auto" ? "Undo auto-buy" : "Cancel order", d: "Within 10 minutes", kind: "undo", active: o.status === "paid" && withinDays(10 / 1440) }] : []),
  ];
  const priceData = [{ d: "Paid", p: o.price }, ...(o.credits || []).filter((c) => c.kind === "price_drop").map((c, i) => ({ d: `Drop ${i + 1}`, p: o.price - (o.credits || []).filter((x) => x.kind === "price_drop").slice(0, i + 1).reduce((s, x) => s + x.amount, 0) })), { d: "Today", p: o.price - (o.credits || []).filter((c) => c.kind === "price_drop").reduce((s, c) => s + c.amount, 0) }];
  const claim = d.claims[0];

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <nav className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <Link href="/orders" className="hover:text-ink">
            Orders
          </Link>
          <ChevronRight size={13} className="text-subtle" />
          <span className="max-w-[40ch] truncate text-ink">{o.title}</span>
        </nav>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <ProductImage src={o.image} title={o.title} className="h-16 w-16 shrink-0 rounded-2xl border border-line" iconSize={26} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[20px] font-semibold tracking-[-0.015em]">{o.title}</h1>
              <StatusBadge status={o.status} />
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[13px] text-muted">
              <StoreName domain={o.store} size={16} className="align-middle" /> · {usd(o.price)} · {when(o.paidAt || o.createdAt)}
            </p>
          </div>
          {live && (
            <div className="flex gap-2">
              <Button variant="outline"  disabled={!!busy} onClick={() => fileRef.current?.click()} before={<Camera size={15} />}>
                {busy === "claim" ? "Checking photo…" : "Report a problem"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) act("claim", "/api/claims", { orderId: o.id, image: await fileToDataUrl(f), reason: "Item arrived damaged" }, "Claim checked");
                }}
              />
            </div>
          )}
        </div>

        {o.status === "refunded" && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-success px-5 py-4 text-white">
            <IconGuarantee size={22} />
            <p className="text-[14px]">
              <b>Kart paid you {usd(back)}.</b> <span className="text-white/85">The money is back in your PayPal. Kart handles {o.store}.</span>
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <section className="card">
              <CardHeader title="Order progress" icon={IconParcel} />
              <ol className="p-5">
                {steps.map((s, i) => {
                  const done = !!s.at;
                  return (
                    <li key={s.title} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < steps.length - 1 && <span className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${steps[i + 1].at ? "bg-action" : "bg-line"}`} />}
                      <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${done ? "border-action bg-action text-white" : "border-line bg-surface text-subtle"}`}>
                        {done ? <Check size={15} strokeWidth={2.5} /> : <s.icon size={14} />}
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className={`text-[13.5px] font-medium ${done ? "" : "text-muted"}`}>{s.title}</span>
                          {s.at && <span className="text-[12px] text-subtle">{when(s.at)}</span>}
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-muted">{s.sub}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {o.storeOrder && (
              <section className="card overflow-hidden">
                <CardHeader title="Store order" icon={IconParcel} sub="Kart's agent placed this order on the store's website for you." />
                <div className="p-5 pt-1">
                  <StoreCheckout so={o.storeOrder} store={o.store} />
                </div>
              </section>
            )}

            <section className="card overflow-hidden">
              <CardHeader title="Kart Guarantee" icon={IconGuarantee} sub="Kart pays you back first, then recovers the money from the store." action={<Badge tone={live ? "green" : "neutral"}>{live ? "Active" : o.status === "refunded" ? "Paid out" : "Ended"}</Badge>} />
              <div className="grid gap-px bg-line sm:grid-cols-2">
                {coverage.map((c, ci) => {
                  const used = (o.credits || []).filter((x) => x.kind === c.kind).reduce((s, x) => s + x.amount, 0);
                  return (
                    <div key={c.t} className={`flex items-start gap-3 bg-surface p-4 ${coverage.length % 2 && ci === coverage.length - 1 ? "sm:col-span-2" : ""}`}>
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${used ? "bg-success-tint text-success" : c.active ? "bg-tint text-action" : "bg-sunken text-subtle"}`}>
                        <c.icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium">{c.t}</span>
                          {used ? <Badge tone="green">Paid {usd(used)}</Badge> : c.active ? <Badge tone="blue">Covered</Badge> : <Badge>—</Badge>}
                        </div>
                        <p className="mt-0.5 text-[12px] text-muted">{c.d}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {(o.credits || []).length > 0 && (
                <div className="border-t border-line px-5 py-3">
                  <div className="eyebrow mb-2">Money back</div>
                  {o.credits.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                      <span className="flex items-center gap-2">
                        <IconMoneyBack size={16} className="text-success" />
                        <span className="font-medium">{usd(c.amount)}</span>
                        <span className="text-muted">
                          {c.kind.replace("_", " ")} · via {c.via === "payout" ? "PayPal Payouts" : "PayPal refund"}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="hidden font-mono text-[11px] text-subtle sm:inline">{c.ref}</span>
                        <Badge tone={c.recovered ? "neutral" : "amber"}>{c.recovered ? "Recovered" : "Kart recovering"}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {claim && <ClaimCard claim={claim} order={o} />}

            <section className="card">
              <CardHeader title="Price Guard" icon={IconPriceGuard} sub="Kart re-checks the price on Channel3 for 30 days." action={back > 0 && (o.credits || []).some((c) => c.kind === "price_drop") ? <Badge tone="green">Saved {usd((o.credits || []).filter((c) => c.kind === "price_drop").reduce((s, c) => s + c.amount, 0))}</Badge> : null} />
              <div className="h-40 px-3 py-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceData} margin={{ left: 0, right: 16, top: 6 }}>
                    <XAxis dataKey="d" tick={{ fontSize: 11, fill: "#8b97a8" }} axisLine={false} tickLine={false} />
                    <YAxis width={44} domain={[(m: number) => Math.floor(m * 0.85), (m: number) => Math.ceil(m * 1.05)]} tick={{ fontSize: 11, fill: "#8b97a8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v) => usd(Number(v))} contentStyle={{ borderRadius: 10, border: "1px solid #e6e9ef", fontSize: 12 }} />
                    <ReferenceLine y={o.price} stroke="#d5dae3" strokeDasharray="4 4" />
                    <Line type="stepAfter" dataKey="p" stroke="#0070E0" strokeWidth={2.25} dot={{ r: 3.5, fill: "#fff", stroke: "#0070E0", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="card">
              <CardHeader title="Payment" icon={IconPay} />
              <div className="px-5 py-3">
                <KV k="You paid" v={usd(o.price)} />
                {back > 0 && <KV k="Paid back by Kart" v={<span className="text-success">−{usd(back)}</span>} />}
                <div className="my-1.5 border-t border-line" />
                <KV k={<b className="text-ink">Net cost</b>} v={<b className="text-[15px]">{usd(o.price - back)}</b>} />
              </div>
              <div className="border-t border-line px-5 py-3">
                <KV k="Paid with" v={<PayPalLogo height={14} />} />
                <KV k="Paid to" v={<StoreName domain={o.store} size={16} />} />
                <KV k="Route" v={o.merchant === "store" ? "Direct to store" : "Kart → instant payout"} />
                <KV k="Kart fee (store)" v={o.fee != null ? usd(o.fee) : "–"} />
                <KV k="PayPal order" v={o.paypalOrderId || "–"} mono />
                <KV k="PayPal transaction" v={o.paypalCaptureId || "–"} mono />
              </div>
              {status?.sandbox && o.paypalCaptureId && (
                <div className="border-t border-line bg-bg px-5 py-3 text-[12.5px] text-muted">
                  <a href="https://www.sandbox.paypal.com/myaccount/activities/" target="_blank" rel="noreferrer" className="font-medium text-action hover:underline">
                    See it in your PayPal sandbox account
                  </a>
                  <span className="mt-0.5 block">Log in with your sandbox Personal account. Look for transaction {o.paypalCaptureId}.</span>
                </div>
              )}
            </section>

            {(live || o.status === "claim_review") && (
              <section className="card">
                <CardHeader title="Need anything?" />
                <div className="grid gap-2 p-4">
                  {(o.status === "paid" || o.status === "shipped") && (
                    <Button variant="outline" size="sm" className="justify-start" disabled={!!busy} onClick={() => act("received", `/api/orders/${o.id}/action`, { action: "received" }, "Thanks! Marked as delivered")} before={<PackageCheck size={14} />}>
                      It arrived
                    </Button>
                  )}
                  {o.status === "shipped" && (
                    <Button variant="outline" size="sm" className="justify-start" disabled={!!busy} onClick={() => act("not_received", `/api/orders/${o.id}/action`, { action: "not_received" }, "Kart paid you back for the missing package")} before={<PackageX size={14} />}>
                      It never arrived
                    </Button>
                  )}
                  {live && (
                    <Button variant="outline" size="sm" className="justify-start" disabled={!!busy} onClick={() => priceCheck()} before={<TrendingDown size={14} />}>
                      {busy === "price" ? "Checking Channel3…" : "Check for a lower price"}
                    </Button>
                  )}
                  {o.lastPriceCheck && (
                    <p className="px-1 text-[12px] text-subtle">
                      Last checked {new Date(o.lastPriceCheck.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}: {usd(o.lastPriceCheck.price)} at {o.store}
                    </p>
                  )}
                  {o.status === "claim_review" && <p className="px-1 text-[12.5px] text-muted">Your claim is with {o.store} for review. Kart pays you as soon as it's approved.</p>}
                </div>
              </section>
            )}

            <section className="card">
              <CardHeader title="Activity" />
              <div className="space-y-3 p-5">
                {d.events.length ? d.events.map((e, i) => <EventRow key={e.id} e={e} compact last={i === d.events.length - 1} />) : <p className="text-[12.5px] text-muted">No activity yet.</p>}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
