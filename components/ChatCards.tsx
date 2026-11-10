"use client";
import { PayPalLogo, StoreName } from "./logos";
import { Button } from "@lemonsqueezy/wedges";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PayPalButtons, PayPalMessages, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { AlertTriangle, ArrowUpRight, Ban, Check, CheckCircle2, ChevronDown, Info, RotateCcw, Sparkles, TrendingDown, Truck, Zap } from "lucide-react";
import type { Claim, Order, Product, UIItem, Watch } from "@/lib/types";
import { api, useApp, usd, usd0 } from "./app-context";
import { Badge, KV, ProductImage, RiskBar, Stars, StatusBadge, useToast } from "./ui";
import { StoreCheckout } from "./StoreCheckout";
import { IconAutoBuy, IconClaim, IconGuarantee, IconPriceGuard } from "./icons";
import { RuleLane, laneVerdict } from "./RuleLane";

const credited = (o: Order) => (o.credits || []).reduce((s, c) => s + c.amount, 0);

// ---------------- products ----------------
/** Channel3 shows every store selling this exact product. Kart buys from the cheapest one in stock. */
function StoreCompare({ p }: { p: Product }) {
  const [open, setOpen] = useState(false);
  const offers = p.offers || [];
  if (offers.length < 2) return null;
  const top = offers[offers.length - 1].price;
  const save = Math.round((top - p.price) * 100) / 100;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-success/20 bg-success-tint/60 px-2.5 py-1.5 text-left text-[11.5px] text-[#0b5e42] transition hover:border-success/40"
      >
        <span>
          <b className="font-semibold">Cheapest of {offers.length} stores</b>
          {save > 0 && <> · saves {usd(save)}</>}
        </span>
        <ChevronDown size={13} className={`shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="anim-in mt-1.5 space-y-1 rounded-lg border border-line bg-surface p-2 text-[12px]">
          {offers.map((o, i) => (
            <li key={o.store} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <StoreName domain={o.store} size={14} />
              </span>
              <span className={`flex shrink-0 items-center gap-1 tabular-nums ${i === 0 ? "font-semibold text-success" : "text-muted"}`} title={i === 0 ? "Kart buys here" : undefined}>
                {i === 0 && <Check size={12} strokeWidth={3} />}
                {usd(o.price)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProductCards({ item, onBuy, disabled }: { item: Extract<UIItem, { kind: "products" }>; onBuy: (p: Product) => void; disabled?: boolean }) {
  const anyCommission = item.products.some((p) => p.commission);
  return (
    <div>
    <div className="grid gap-3 sm:grid-cols-3">
      {item.products.map((p, i) => {
        const best = p.id === item.bestPickId;
        const save = p.compareAt && p.compareAt > p.price ? p.compareAt - p.price : 0;
        return (
          <div
            key={p.id}
            style={{ animationDelay: `${i * 60}ms` }}
            className={`anim-in group relative flex flex-col overflow-hidden rounded-2xl border bg-surface transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] ${best ? "border-action/60 shadow-[0_0_0_3px_rgba(0,112,224,0.08)]" : "border-line shadow-[var(--shadow-card)]"}`}
          >
            <div className="relative">
              <ProductImage src={p.image} title={p.title} className="aspect-[4/3] w-full p-3" iconSize={38} />
              {best && (
                <span className="badge absolute left-2.5 top-2.5 bg-navy text-white shadow-sm">
                  <Sparkles size={11} /> Kart pick
                </span>
              )}
              {save > 0 && <span className="badge absolute right-2.5 top-2.5 bg-success text-white">−{Math.round((save / p.compareAt!) * 100)}%</span>}
            </div>
            <div className="flex flex-1 flex-col border-t border-line p-3.5">
              <div className="flex items-center gap-1.5 text-[11.5px] text-subtle">
                <StoreName domain={p.store} size={16} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-[13.5px] font-medium leading-snug">{p.title}</p>
              <div className="mt-1.5">
                <Stars rating={p.rating} reviews={p.reviews} />
              </div>
              <StoreCompare p={p} />
              {item.reasons[p.id] && <p className="mt-2.5 flex-1 rounded-lg bg-sunken px-2.5 py-2 text-[12px] leading-relaxed text-muted">{item.reasons[p.id]}</p>}
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[17px] font-semibold tracking-tight tabular-nums">{usd(p.price)}</div>
                  {save > 0 && <div className="text-[11px] text-subtle line-through">{usd(p.compareAt)}</div>}
                </div>
                <Button size="sm" variant={best ? "primary" : "outline"} disabled={disabled} onClick={() => onBuy(p)}>
                  Buy
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    <p className="mt-2 text-[11.5px] text-subtle">
      Prices from Channel3. Kart checks the live price again right before paying.{anyCommission ? " Kart may earn a commission from the brand when you buy." : ""}
    </p>
    </div>
  );
}

// ---------------- checkout ----------------
function PayButtons({ product, chatId, itemId, saveRef, onPaid, onError }: any) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const sandbox = useApp().status?.sandbox;
  const create = (fundingSource: string) => async () => {
    const a = await api<{ token: string | null }>("/api/approve", { productId: product.id });
    const r = await api<{ id: string }>("/api/paypal/create-order", { productId: product.id, chatId, token: a.token, saveMandate: saveRef.current, fundingSource });
    return r.id;
  };
  const approve = async (data: { orderID: string }) => {
    const r = await api<{ order: Order & { mandateSaved?: boolean } }>("/api/paypal/capture-order", { paypalOrderId: data.orderID, chatId, itemId });
    onPaid(r.order);
  };
  if (isRejected) return <p className="text-xs text-danger">PayPal couldn't load. Check PAYPAL_CLIENT_ID.</p>;
  if (isPending) return <div className="shimmer h-11 rounded-xl" />;
  const style = { layout: "horizontal" as const, shape: "rect" as const, height: 44, tagline: false, borderRadius: 10 };
  // Closing the PayPal window is a cancel, not an error: say so plainly instead of PayPal's internal message.
  const blur = () => (document.activeElement as HTMLElement | null)?.blur?.();
  const onErr = (e: any) => {
    blur();
    const msg = String(e?.message || e);
    if (/window is closed|popup.*closed|closed/i.test(msg)) return onError("PayPal window closed before paying. Nothing was charged. Tap a PayPal button to try again.");
    onError(msg);
  };
  const onCancel = () => {
    blur();
    onError("You closed PayPal before paying. Nothing was charged.");
  };
  const clearErr = () => onError("");
  return (
    <div className="kart-paypal space-y-2 px-px">
      <PayPalButtons fundingSource="paypal" style={{ ...style, color: "gold", label: "pay" }} createOrder={create("paypal")} onApprove={approve} onError={onErr} onCancel={onCancel} onClick={clearErr} />
      <PayPalButtons fundingSource="paylater" style={{ ...style, color: "white" }} createOrder={create("paylater")} onApprove={approve} onError={onErr} onCancel={onCancel} onClick={clearErr} />
      <PayPalMessages amount={product.price} style={{ layout: "text", text: { size: 12, align: "center" } }} />
      {sandbox && (
        <p className="text-center text-[11.5px] leading-snug text-subtle">
          Sandbox: log in with your PayPal <b>sandbox Personal</b> account (developer.paypal.com → Sandbox accounts), not your real PayPal.
        </p>
      )}
    </div>
  );
}

/** Muse-style one-tap order: confirm on the card, Kart pays with the saved PayPal. No popup. */
function ConfirmPay({ product, chatId, itemId, onPaid, onPopup }: { product: Product; chatId: string; itemId: string; onPaid: (o: Order) => void; onPopup: () => void }) {
  const { rules } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const confirm = async (acknowledged: boolean) => {
    setBusy(true);
    setErr("");
    try {
      const a = await api<{ token: string; warnings: string[] }>("/api/approve", { productId: product.id });
      if (a.warnings?.length && !acknowledged) {
        setWarnings(a.warnings); // second tap needed for anything unusual
        return;
      }
      const r = await api<{ order: Order }>("/api/confirm-order", { productId: product.id, token: a.token, chatId, itemId });
      onPaid(r.order);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="mb-3 rounded-xl border border-line px-3.5 py-1">
        <KV k="Pay with" v={<span className="flex items-center gap-1.5"><PayPalLogo height={13} /><span className="max-w-[170px] truncate text-muted">{rules?.payerEmail || "saved PayPal"}</span></span>} />
        <KV k="Ship to" v={<span className="block max-w-[230px] truncate text-right">{rules?.shipTo || "Your PayPal address"}</span>} />
      </div>
      {warnings && (
        <div className="mb-3 rounded-xl border border-warn/30 bg-warn-tint px-3.5 py-2.5 text-[12.5px] text-warn">
          <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> Check before paying</p>
          <ul className="mt-1 list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={busy} onClick={onPopup}>
          Use PayPal checkout
        </Button>
        <Button className="flex-[1.4]" disabled={busy} onClick={() => confirm(!!warnings)} before={busy ? undefined : <Check size={15} />}>
          {busy ? "Paying…" : warnings ? `Yes, pay ${usd(product.price)}` : `Confirm & pay ${usd(product.price)}`}
        </Button>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      <p className="mt-2.5 text-center text-[11px] text-subtle">Price locked · signed one-time approval · cancel free for 10 minutes</p>
    </div>
  );
}

function PayPalSetupNeeded() {
  return (
    <div className="rounded-xl border border-warn/30 bg-warn-tint px-3.5 py-3 text-[12.5px] text-warn">
      <b>PayPal isn't connected yet.</b> Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env.local and restart Kart to pay.
    </div>
  );
}

export function GuaranteeNote({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-success-tint/70 px-3 py-2.5">
      <IconGuarantee size={18} className="shrink-0 text-success" />
      <p className="text-[12.5px] leading-snug text-[#0b5e42]">
        <b className="font-semibold">Kart Guarantee</b> · damaged, lost or cheaper within 30 days? Paid back instantly{compact ? "" : ", no chasing the store"}.
      </p>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; hint: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5">
      <IconAutoBuy size={20} className="shrink-0 text-[#b56f00]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-ink">{label}</span>
        <span className="block text-[11.5px] text-muted">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Save PayPal for one-tap orders"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-action" : "bg-line-strong"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export function ApprovalCard({ item, chatId, onChanged }: { item: Extract<UIItem, { kind: "approval" }>; chatId: string; onChanged: () => void }) {
  const { status, rules, refreshRules } = useApp();
  const toast = useToast();
  const [save, setSave] = useState(true);
  const saveRef = useRef(true);
  const [err, setErr] = useState("");
  const [paid, setPaid] = useState<Order | null>(null);
  const [popup, setPopup] = useState(false);
  const p = item.product;
  const oneTap = !!rules?.mandateActive && !popup;
  const ask = item.decision === "needs_approval";
  const isPaid = item.state === "paid" || !!paid;
  const onPaid = async (o: Order & { mandateSaved?: boolean }) => {
    setPaid(o);
    toast({ tone: "success", title: `Paid ${usd(o.price)} to ${o.store}`, text: o.mandateSaved ? "Agent Mandate connected: Kart can now auto-buy within your limit." : "Covered by Kart Guarantee." });
    await refreshRules();
    onChanged();
  };
  return (
    <div className="anim-in w-full max-w-[440px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]">
      <div className="flex items-center justify-between px-5 pt-4">
        <span>
          <span className="block text-[14px] font-semibold">{isPaid ? "Purchase complete" : "Confirm your order"}</span>
          <span className="block text-[11.5px] text-muted">{ask ? `Above your ${usd0(rules?.autoBuyUnder ?? 30)} auto-buy limit` : item.rule}</span>
        </span>
        {ask ? (
          <Badge tone="amber">
            <Info size={11} /> Needs your OK
          </Badge>
        ) : (
          <Badge tone="green">
            <Zap size={11} /> Within auto-buy
          </Badge>
        )}
      </div>
      <div className="flex gap-3.5 px-5 pt-4">
        <ProductImage src={p.image} title={p.title} className="h-16 w-16 shrink-0 rounded-xl border border-line" iconSize={24} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13.5px] font-medium leading-snug">{p.title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            Sold by <StoreName domain={p.store} size={15} className="font-medium text-ink" />
          </p>
        </div>
      </div>
      {rules && (
        <div className="mx-5 mt-4">
          <RuleLane rules={rules} pin={p.price} />
          <p className="mt-0.5 text-[12px] font-medium" style={{ color: laneVerdict(p.price, rules).color }}>
            {laneVerdict(p.price, rules).text}
          </p>
        </div>
      )}
      <div className="mx-5 mt-4 border-t border-dashed border-line pt-3">
        <KV k="Item" v={usd(p.price)} />
        {!oneTap && <KV k="Paid with" v={<PayPalLogo height={14} />} />}
        <KV k="Paid to" v={<StoreName domain={p.store} size={16} />} />
        <div className="mt-1 flex items-center justify-between border-t border-line pt-2.5">
          <span className="text-[13.5px] font-semibold">Total</span>
          <span className="text-[18px] font-semibold tracking-tight tabular-nums">{usd(p.price)}</span>
        </div>
      </div>
      <div className="px-5 pt-3">
        <GuaranteeNote />
      </div>
      <div className="p-5">
        {isPaid ? (
          <div className="flex items-center justify-between rounded-xl bg-success-tint px-3.5 py-3 text-success">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold">
              <CheckCircle2 size={17} /> Paid with PayPal
            </span>
            {(paid?.id || item.orderId) && (
              <Link href={`/orders/${paid?.id || item.orderId}`} className="flex items-center gap-1 text-xs font-semibold hover:underline">
                View order <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
        ) : (
          <>
            {!rules?.mandateActive && (
              <div className="mb-3">
                <Toggle
                  checked={save}
                  onChange={(v) => {
                    setSave(v);
                    saveRef.current = v;
                  }}
                  label="Save PayPal for one-tap orders"
                  hint={`Next time: confirm and Kart pays. Auto-buy up to ${usd0(rules?.autoBuyUnder ?? 30)}. Revoke anytime.`}
                />
              </div>
            )}
            {status?.paypal && oneTap ? (
              <ConfirmPay product={p} chatId={chatId} itemId={item.id} onPaid={onPaid} onPopup={() => setPopup(true)} />
            ) : status?.paypal && status.clientId ? (
              <PayButtons product={p} chatId={chatId} itemId={item.id} saveRef={saveRef} onPaid={onPaid} onError={setErr} />
            ) : (
              <PayPalSetupNeeded />
            )}
            {err && <p className={`mt-2 text-[12.5px] ${/Nothing was charged/.test(err) ? "text-muted" : "text-danger"}`}>{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export function BlockedCard({ item }: { item: Extract<UIItem, { kind: "blocked" }> }) {
  const { rules } = useApp();
  const p = item.product;
  return (
    <div className="anim-in w-full max-w-[440px] overflow-hidden rounded-2xl border border-danger/25 bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3 px-5 pt-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger-tint text-danger">
          <Ban size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">Stopped by your rules</p>
          <p className="mt-0.5 text-[12.5px] text-muted">{item.reason}</p>
        </div>
      </div>
      {rules && (
        <div className="mx-5 mt-3">
          <RuleLane rules={rules} pin={p.price} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line bg-danger-tint/40 px-5 py-2.5">
        <p className="min-w-0 truncate text-[12.5px] text-muted">{p.title}</p>
        <p className="shrink-0 text-[12.5px] font-semibold text-danger">No money moved</p>
      </div>
    </div>
  );
}

const STEPS = ["Paid", "Ordered", "Shipped", "Delivered"];
function stepsDone(o: Order) {
  return [!!o.paidAt, !!(o.storeOrder || o.paidAt), !!o.shippedAt, !!o.deliveredAt];
}

export function OrderCard({ order, auto, onChanged }: { order: Order; auto?: boolean; onChanged: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isAuto = auto || order.buyMode === "auto";
  const canUndo = (isAuto || order.buyMode === "confirmed") && order.status === "paid" && Date.now() - new Date(order.paidAt || order.createdAt).getTime() < 10 * 60_000;
  const done = stepsDone(order);
  const back = credited(order);
  const { rules } = useApp();
  return (
    <div className="anim-in w-full max-w-[440px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 px-5 pt-4">
        <span className={`grid h-9 w-9 place-items-center rounded-full ${isAuto ? "bg-success-tint text-success" : "bg-tint text-action"}`}>{isAuto ? <IconAutoBuy size={18} /> : <Check size={17} />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">{isAuto ? "Bought for you" : "Order placed"}</p>
          <p className="text-xs text-muted">{isAuto ? "Paid with your saved PayPal · within your auto-buy rule" : order.buyMode === "confirmed" ? "You confirmed · paid with your saved PayPal" : `${order.store} has been paid via PayPal`}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl bg-sunken p-3">
        <ProductImage src={order.image} title={order.title} className="h-11 w-11 shrink-0 rounded-lg border border-line" iconSize={18} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{order.title}</p>
          <StoreName domain={order.store} size={14} className="text-[11.5px] text-muted" />
        </div>
        <div className="text-right">
          <div className="text-[15px] font-semibold tabular-nums">{usd(order.price)}</div>
          {back > 0 && <div className="text-[11px] text-success">−{usd(back)} back</div>}
        </div>
      </div>
      {rules && order.status !== "refunded" && (
        <div className="mx-5 mt-3">
          <RuleLane rules={rules} pin={order.price} />
        </div>
      )}
      {order.storeOrder && (
        <div className="mx-5 mt-3">
          <StoreCheckout so={order.storeOrder} store={order.store} compact />
        </div>
      )}
      <div className="mx-5 mt-4 grid grid-cols-4 gap-1">
        {STEPS.map((s, i) => (
          <div key={s}>
            <div className={`h-1 rounded-full ${done[i] ? "bg-action" : "bg-sunken"}`} />
            <div className={`mt-1.5 text-[11px] ${done[i] ? "font-medium text-ink" : "text-subtle"}`}>{s}</div>
          </div>
        ))}
      </div>
      <div className="mx-5 mt-3 border-t border-line pt-2">
        <KV k="PayPal capture" v={order.paypalCaptureId || "–"} mono />
        <KV k="Paid to" v={<StoreName domain={order.store} size={16} />} />
        <KV k="Route" v={order.merchant === "store" ? "Direct from your PayPal" : "Kart → instant PayPal payout"} />
      </div>
      <div className="flex items-center gap-2 p-5 pt-3">
        <Button variant="outline" size="sm" before={<Truck size={14} />} onClick={() => router.push(`/orders/${order.id}`)}>
          Track order
        </Button>
        {canUndo && (
          <Button variant="transparent" size="sm"
            
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/paypal/auto-buy", { undoOrderId: order.id });
                toast({ tone: "success", title: isAuto ? "Auto-buy undone" : "Order cancelled", text: `${usd(order.price)} is back in your PayPal.` });
                onChanged();
              } catch (e) {
                toast({ tone: "error", title: "Couldn't undo", text: (e as Error).message });
              } finally {
                setBusy(false);
              }
            }} before={<RotateCcw size={13} />}>
            {isAuto ? "Undo" : "Cancel order"}
          </Button>
        )}
        <span className="ml-auto flex items-center gap-1 text-[11.5px] text-success">
          <IconGuarantee size={14} /> Kart Guarantee
        </span>
      </div>
    </div>
  );
}

// ---------------- claim ----------------
export function ClaimCard({ claim, order }: { claim: Claim; order: Order }) {
  const ok = claim.decision === "auto_refund";
  const paidBack = order.credits?.find((c) => c.ref === claim.refundId)?.amount ?? order.price;
  return (
    <div className="anim-in w-full max-w-[440px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-tint text-violet">
          <IconClaim size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">Damage check</p>
          <p className="truncate text-xs text-muted">{order.title}</p>
        </div>
        <Badge tone={ok ? "green" : "amber"}>{ok ? "Approved" : "In review"}</Badge>
      </div>
      <div className="space-y-4 p-5">
        <div className="rounded-xl bg-sunken px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink">
          <span className="eyebrow mb-1 block">Claude vision</span>
          {claim.vision.summary}
        </div>
        <ul className="space-y-1.5">
          {claim.reasons.slice(1).map((r) => {
            const bad = /\(\+0\.[1-9]/.test(r) && !r.startsWith("Vision confidence");
            return (
              <li key={r} className="flex items-center gap-2 text-[12.5px]">
                {bad ? <AlertTriangle size={14} className="shrink-0 text-danger" /> : <CheckCircle2 size={14} className="shrink-0 text-success" />}
                <span className={bad ? "text-danger" : "text-muted"}>{r}</span>
              </li>
            );
          })}
        </ul>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12.5px] font-medium">Fraud risk score</span>
            <span className="text-[18px] font-semibold tabular-nums">{claim.riskScore.toFixed(2)}</span>
          </div>
          <RiskBar score={claim.riskScore} />
        </div>
        {ok ? (
          <div className="rounded-xl bg-success p-4 text-white">
            <div className="flex items-center gap-2 text-[14px] font-semibold">
              <CheckCircle2 size={18} /> Kart paid you {usd(paidBack)}
            </div>
            <p className="mt-1 text-[12px] text-white/85">Instantly via PayPal ({claim.refundId}). Kart handles the return with {order.store}; you don't have to.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-warn-tint p-3.5 text-[12.5px] text-warn">
            <b>Sent for review.</b> The risk is above 0.30, so a person checks it, usually within a day.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- notices + watch ----------------
export function NoticeCard({ item }: { item: Extract<UIItem, { kind: "notice" }> }) {
  const tone = item.tone === "success" ? "bg-success-tint text-success" : item.tone === "warning" ? "bg-warn-tint text-warn" : "bg-tint text-action";
  const Icon = item.tone === "success" ? CheckCircle2 : item.title.includes("Price") ? TrendingDown : item.title === "Shipped" ? Truck : Info;
  return (
    <div className="anim-in flex w-full max-w-[520px] items-center gap-3 rounded-xl border border-line bg-surface/70 px-3.5 py-2.5">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon size={14} />
      </span>
      <p className="min-w-0 flex-1 text-[12.5px] text-muted">
        <b className="font-semibold text-ink">{item.title}.</b> {item.text}
      </p>
      {item.orderId && (
        <Link href={`/orders/${item.orderId}`} className="shrink-0 text-xs font-medium text-action hover:underline">
          View
        </Link>
      )}
    </div>
  );
}

export function WatchCard({ watch, chatId, onChanged }: { watch: Watch; chatId: string; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api<{ bought: boolean; message?: string; price: number }>("/api/watch", { watchId: watch.id, chatId });
      toast({ tone: r.bought ? "success" : "info", title: r.bought ? `Bought at ${usd(r.price)}` : "Kart Watch", text: r.bought ? "Within your auto-buy rule." : r.message });
      onChanged();
    } catch (e) {
      toast({ tone: "error", title: "Watch failed", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="anim-in w-full max-w-[440px] rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint text-action">
          <IconPriceGuard size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">Kart Watch is on</p>
          <p className="truncate text-xs text-muted">{watch.title}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-sunken p-2.5">
          <div className="text-[11px] text-subtle">Now</div>
          <div className="text-[15px] font-semibold tabular-nums">{usd(watch.lastPrice)}</div>
        </div>
        <div className="rounded-xl bg-tint p-2.5">
          <div className="text-[11px] text-action">Buy at</div>
          <div className="text-[15px] font-semibold tabular-nums text-navy">≤ {usd(watch.targetPrice)}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1"  disabled={busy} onClick={() => run()}>
          Check price
        </Button>

      </div>
    </div>
  );
}
