"use client";
import { Button } from "@lemonsqueezy/wedges";
import { PayPalMark, StoreLogo } from "@/components/logos";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Inbox, Package, Receipt, RotateCcw, Store, Truck, Wallet } from "lucide-react";
import type { Order } from "@/lib/types";
import { api, usd, useApp } from "@/components/app-context";
import { useSession } from "@/components/session";
import { Badge, CardHeader, EmptyState, PageHeader, ProductImage, Skeleton, Stat, StatusBadge, useToast } from "@/components/ui";

const credited = (o: Order) => (o.credits || []).reduce((s, c) => s + c.amount, 0);

export default function StoreDashboard() {
  const toast = useToast();
  const { status } = useApp();
  const feeRate = status?.feeRate ?? 0.05;
  const [orders, setOrders] = useState<Order[] | null>(null);
  const session = useSession();
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const r = await api<{ orders: Order[] }>("/api/orders");
    setOrders(r.orders.filter((o) => o.status !== "created"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  // The API only returns this store's own orders (signed store session).
  const router = useRouter();
  const [info, setInfo] = useState<{ domain: string; demo: boolean; paidTo: string; own: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/stores", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => (r.current ? setInfo(r.current) : router.replace("/store/connect")))
      .catch(() => {});
  }, [router]);
  const demo = info?.demo || session?.store === "demo";
  const current = demo ? "Demo store" : session?.store || "";
  const mine = useMemo(() => orders || [], [orders]);
  const k = useMemo(() => {
    const sales = mine.reduce((s, o) => s + o.price, 0);
    const fees = mine.reduce((s, o) => s + (o.fee ?? o.price * feeRate), 0);
    const returns = mine.reduce((s, o) => s + credited(o), 0);
    const toShip = mine.filter((o) => o.status === "paid").length;
    return { sales, fees, returns, toShip };
  }, [mine, feeRate]);

  const [shipping, setShipping] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("USPS");
  const act = async (o: Order, url: string, body: unknown, ok: string) => {
    setBusy(o.id);
    try {
      await api(url, body);
      toast({ tone: "success", title: ok });
      await load();
    } catch (e) {
      toast({ tone: "error", title: "Action failed", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };
  const ship = async (o: Order) => {
    setBusy(o.id);
    try {
      await api("/api/paypal/ship", { orderId: o.id, trackingNumber: tracking, carrier });
      setShipping(null);
      setTracking("");
      toast({ tone: "success", title: "Marked as shipped", text: "Tracking added to the PayPal transaction." });
      await load();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't ship", text: (e as Error).message });
    } finally {
      setBusy("");
    }
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
        {demo && (
          <div className="rounded-xl border border-violet/20 bg-violet-tint px-4 py-3 text-[13px] leading-relaxed text-[#3d2a8a]">
            <b className="font-semibold">Demo store.</b> These are the orders you placed as the demo shopper in this browser, whatever store they came from. Ship them, approve claims and settle refunds here, then check the result on the shopper side and in PayPal sandbox.
          </div>
        )}

        {!orders ? (
          <div className="grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
        ) : (
          <>
            <div className="card flex flex-wrap items-center gap-4 px-5 py-4">
              {demo ? (
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-tint text-violet">
                  <Store size={20} />
                </span>
              ) : (
                <StoreLogo domain={current} size={44} />
              )}
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

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Sales via Kart" value={usd(k.sales)} sub={`${mine.length} order${mine.length === 1 ? "" : "s"}`} icon={Receipt} tone="blue" />
              <Stat label="To ship" value={k.toShip} sub="Paid, waiting for tracking" icon={Package} tone="amber" />
              <Stat label={`Kart fee (${Math.round(feeRate * 1000) / 10}%)`} value={usd(k.fees)} sub="Invoiced monthly" icon={Wallet} />
              <Stat label="Returns / adjustments" value={usd(k.returns)} sub="Paid to shoppers by Kart" icon={RotateCcw} tone="violet" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
              <section className="card overflow-hidden">
                <CardHeader title="Orders" icon={Receipt} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-[13px]">
                    <thead>
                      <tr className="bg-sunken/60 text-left text-[11.5px] text-muted">
                        <th className="px-5 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Sale</th>
                        <th className="px-3 py-2 text-right font-medium">Kart fee</th>
                        <th className="px-5 py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!mine.length && (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState
                              icon={Inbox}
                              title="No orders from Kart shoppers yet"
                              text={demo ? "Switch to the shopper side, buy something as the demo shopper, then come back here to ship it." : "When a shopper buys from your store through Kart, the order shows up here, already paid with PayPal."}
                            />
                          </td>
                        </tr>
                      )}
                      {mine.map((o) => (
                        <tr key={o.id} className="border-t border-line">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <ProductImage src={o.image} title={o.title} className="h-9 w-9 shrink-0 rounded-lg border border-line" iconSize={15} />
                              <span className="min-w-0">
                                <span className="block max-w-[240px] truncate font-medium">{o.title}</span>
                                <span className="font-mono text-[11px] text-subtle">{o.storeOrder ? `#${o.storeOrder.number}` : o.id}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">{usd(o.price)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted">{usd(o.fee ?? o.price * feeRate)}</td>
                          <td className="px-5 py-3 text-right">
                            {o.status === "paid" ? (
                              shipping === o.id ? (
                                <form
                                  className="flex items-center justify-end gap-1.5"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    ship(o);
                                  }}
                                >
                                  <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px]" aria-label="Carrier">
                                    {["USPS", "UPS", "FedEx", "DHL"].map((c) => (
                                      <option key={c}>{c}</option>
                                    ))}
                                  </select>
                                  <input autoFocus value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" className="h-8 w-40 rounded-lg border border-line px-2 text-[12.5px] outline-none focus:border-action" />
                                  <Button type="submit" variant="primary" size="sm" disabled={busy === o.id || !tracking.trim()}>
                                    {busy === o.id ? "Saving…" : "Ship"}
                                  </Button>
                                  <Button type="button" variant="transparent" size="sm" onClick={() => setShipping(null)}>
                                    Cancel
                                  </Button>
                                </form>
                              ) : (
                                <Button variant="primary" size="sm" onClick={() => setShipping(o.id)} before={<Truck size={13} />}>
                                  Mark shipped
                                </Button>
                              )
                            ) : o.status === "claim_review" ? (
                              <Button variant="outline" size="sm" disabled={busy === o.id} onClick={() => act(o, "/api/guarantee", { orderId: o.id, action: "approve_claim" }, "Claim approved: Kart paid the shopper")} before={<Check size={13} />}>
                                Approve claim
                              </Button>
                            ) : (o.credits || []).some((c) => !c.recovered) ? (
                              <Button variant="outline" size="sm" disabled={busy === o.id} onClick={() => act(o, "/api/guarantee", { orderId: o.id, action: "recover" }, "Settled with Kart")} before={<RotateCcw size={13} />}>
                                Settle {usd((o.credits || []).filter((c) => !c.recovered).reduce((x, c) => x + c.amount, 0))}
                              </Button>
                            ) : (
                              <span className="text-[12px] text-subtle">{o.trackingNumber ? `${o.carrier || "USPS"} …${o.trackingNumber.slice(-6)}` : "—"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card h-fit p-5">
                <h3 className="text-[14px] font-semibold">How Kart pays you</h3>
                <ul className="mt-3 space-y-2.5 text-[12.5px]">
                  {[
                    ["Paid instantly", "Shoppers pay your PayPal account directly when the order is placed."],
                    [`${Math.round(feeRate * 1000) / 10}% Kart fee`, "Only on orders Kart sends you, invoiced monthly."],
                    ["Kart handles the shopper", "Damage, lost packages and price drops are paid back by Kart; you settle returns here."],
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
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
