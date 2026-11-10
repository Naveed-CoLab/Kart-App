/**
 * Store checkout agent (DEMO in sandbox).
 *
 * In production Kart would place the order on the store's own website/API after PayPal pays
 * (store checkout APIs, Shopify/Channel3 checkout, or PayPal Agent Ready). Sandbox PayPal money
 * can't buy real goods, so here the store-side order is simulated: same steps, a store order
 * number, and a clear "Demo" label. Everything before it (search, rules, PayPal sandbox payment)
 * and after it (tracking, Kart Guarantee) is real.
 */
import { config, money, now } from "./config";
import { logEvent } from "./db";
import type { Order, StoreOrder } from "./types";

const PREFIX: Record<string, string> = { target: "TGT", walmart: "WMT", amazon: "AMZ", nike: "NKE", adidas: "ADS", etsy: "ETSY", ebay: "EBY", bestbuy: "BBY", ikea: "IKEA", uniqlo: "UQ", zara: "ZRA", apple: "APL", samsung: "SMG" };

function storeKey(domain: string) {
  return domain.replace(/^www\./, "").split(".")[0].toLowerCase();
}

export function placeStoreOrder(o: Order, shipTo?: string | null): StoreOrder {
  const key = storeKey(o.store);
  const prefix = PREFIX[key] || key.slice(0, 4).toUpperCase();
  const number = `${prefix}-${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const t0 = Date.now();
  const at = (s: number) => new Date(t0 + s * 1000).toISOString();
  const steps = [
    { label: `Opened ${o.store} checkout`, at: at(0) },
    { label: `Added “${o.title.slice(0, 60)}” to cart · $${money(o.price)}`, at: at(1) },
    { label: shipTo ? `Shipping to ${shipTo}` : "Used your PayPal shipping address", at: at(2) },
    { label: "Paid with PayPal (sandbox)", at: at(3) },
    { label: `Order confirmed · #${number}`, at: at(4) },
  ];
  const so: StoreOrder = { number, mode: config.storeCheckout, placedAt: now(), url: `https://${o.store.replace(/^www\./, "")}`, steps };
  logEvent({ type: "store_order", orderId: o.id, amount: o.price, rule: so.mode === "demo" ? "Store checkout (demo)" : "Store checkout", reason: `Kart placed the order on ${o.store}: #${number}.${so.mode === "demo" ? " Sandbox demo: no real store order is created." : ""}`, ref: number });
  return so;
}
