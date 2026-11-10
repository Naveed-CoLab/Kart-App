/**
 * Store accounts.
 *  - A store owner signs in, claims a domain, and proves they own it: a DNS TXT record or a file on the site.
 *  - Then they connect PayPal: PayPal partner sign-up ("Connect with PayPal"), or their PayPal business email.
 *  - Orders from that store are paid straight into that PayPal account.
 *  - Stores that haven't joined yet are paid through Kart's sandbox store account (STORE_PAYPAL_EMAIL).
 */
import crypto from "crypto";
import { promises as dns } from "dns";
import { config, now } from "./config";
import { asTenant, db, eachTenant, mutate, tenantOfOrder } from "./db";
import type { Session } from "./session";
import { KartError } from "./orders";
import type { StoreAccount } from "./types";
import { MIN, rateLimit } from "./rateLimit";

export const PLATFORM = "__platform";
export const DEMO_STORE = "demo";

const onPlatform = <T>(fn: () => T) => asTenant(PLATFORM, fn);
const all = () => onPlatform(() => db().stores || {});

export const normalizeDomain = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
/** A public domain name: labels of letters/digits/hyphens, a letter TLD, never an IP or internal name. */
const validDomain = (d: string) =>
  d.length <= 253 && /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,63}$/.test(d) && !/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(d);

/** True for loopback, private, link-local, CGNAT and other non-public addresses (IPv4 and IPv6). */
function privateAddress(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Before Kart's server opens a store's website, make sure the domain points at the public internet. */
async function assertPublicHost(domain: string) {
  if (!validDomain(domain)) throw new KartError("Enter a public domain like yourstore.com.", 422);
  const addrs = await dns.lookup(domain, { all: true }).catch(() => []);
  if (!addrs.length) throw new KartError(`Couldn't find ${domain}. Check the domain and try again.`, 422);
  if (addrs.some((a) => privateAddress(a.address))) throw new KartError(`${domain} doesn't point to a public website.`, 422);
}
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function getStore(domain: string): StoreAccount | null {
  return all()[normalizeDomain(domain)] || null;
}

export function storesOwnedBy(uid: string): StoreAccount[] {
  return Object.values(all())
    .filter((s) => s.ownerUid === uid)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Start (or restart) a claim on a domain. */
export function claimStore(uid: string, ownerName: string, rawDomain: string, paypalEmail?: string | null) {
  const domain = normalizeDomain(rawDomain);
  if (!validDomain(domain)) throw new KartError("Enter your store's domain, like mystore.com");
  if (paypalEmail && !validEmail(paypalEmail)) throw new KartError("Enter a valid PayPal business email");
  const existing = getStore(domain);
  if (existing?.verified && existing.ownerUid !== uid) throw new KartError(`${domain} is already verified by another account.`, 409);
  return onPlatform(() =>
    mutate((d) => {
      d.stores ??= {};
      const keep = existing && existing.ownerUid === uid ? existing : null;
      const rec: StoreAccount = {
        domain,
        ownerUid: uid,
        ownerName,
        verifyToken: keep?.verifyToken || `kart-verify-${crypto.randomBytes(12).toString("hex")}`,
        verified: keep?.verified || false,
        verifiedBy: keep?.verifiedBy || null,
        verifiedAt: keep?.verifiedAt || null,
        paypalEmail: paypalEmail ?? keep?.paypalEmail ?? null,
        merchantId: keep?.merchantId || null,
        paypalConnectedAt: paypalEmail ? now() : keep?.paypalConnectedAt || null,
        createdAt: keep?.createdAt || now(),
      };
      d.stores[domain] = rec;
      return rec;
    }),
  );
}

function ownerRecord(uid: string, domain: string) {
  const s = getStore(domain);
  if (!s || s.ownerUid !== uid) throw new KartError("You haven't claimed this store.", 403);
  return s;
}

/** Check the DNS TXT record or the file on the store's website. */
export async function verifyStore(uid: string, domain: string, method: "dns" | "file") {
  const s = ownerRecord(uid, domain);
  let ok = false;
  let detail = "";
  if (method === "dns") {
    try {
      const recs = (await dns.resolveTxt(s.domain)).map((r) => r.join(""));
      ok = recs.some((r) => r.trim() === `kart-verification=${s.verifyToken}`);
      detail = ok ? "" : `No TXT record "kart-verification=${s.verifyToken}" found on ${s.domain} yet. DNS changes can take a few minutes.`;
    } catch {
      detail = `Couldn't read DNS for ${s.domain}. Check the domain and try again in a few minutes.`;
    }
  } else {
    const url = `https://${s.domain}/.well-known/kart-verification.txt`;
    await assertPublicHost(s.domain);
    try {
      // No redirects (they could lead to an internal address), a short timeout and a small read.
      const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store", redirect: "manual" });
      const text = res.ok ? (await res.text()).slice(0, 4096) : "";
      ok = text.includes(s.verifyToken);
      detail = ok ? "" : res.ok ? `${url} doesn't contain the code yet.` : `${url} returned ${res.status}.`;
    } catch {
      detail = `Couldn't open ${url}.`;
    }
  }
  if (!ok) throw new KartError(detail, 422);
  return onPlatform(() =>
    mutate((d) => {
      const rec = d.stores![s.domain];
      Object.assign(rec, { verified: true, verifiedBy: method, verifiedAt: now() });
      return rec;
    }),
  );
}

export function setStorePayPal(uid: string, domain: string, patch: { paypalEmail?: string | null; merchantId?: string | null }) {
  const s = ownerRecord(uid, domain);
  if (patch.paypalEmail && !validEmail(patch.paypalEmail)) throw new KartError("Enter a valid PayPal business email");
  return onPlatform(() =>
    mutate((d) => {
      const rec = d.stores![s.domain];
      Object.assign(rec, patch, { paypalConnectedAt: now() });
      return rec;
    }),
  );
}

/** Find a claim by its PayPal partner sign-up tracking id. */
export function storeByTracking(trackingId: string) {
  return Object.values(all()).find((s) => s.verifyToken.slice(-16) === trackingId) || null;
}

/** Where a store's money goes: its own PayPal if it joined Kart, otherwise Kart's sandbox store account. */
export function payeeFor(store: string): string | null {
  const s = getStore(store);
  if (s?.verified && s.merchantId) return `merchant:${s.merchantId}`;
  if (s?.verified && s.paypalEmail) return s.paypalEmail;
  return config.storePayees[store] || config.storeEmail || null;
}

export function paidToLabel(store: string): { label: string; own: boolean } {
  const s = getStore(store);
  if (s?.verified && s.merchantId) return { label: "Store's PayPal (connected with PayPal)", own: true };
  if (s?.verified && s.paypalEmail) return { label: `Store's PayPal (${s.paypalEmail})`, own: true };
  return { label: "Kart's sandbox store account", own: false };
}

/** Which shopper's data holds this order, if this store session may act on it. */
/**
 * Store actions that move money (refunds, guarantee settlements) or change an order.
 * The demo store acts on the browser's own demo orders, so it only works in PayPal sandbox:
 * on live PayPal a shopper could otherwise refund themselves through it. Rate-limited per store.
 */
export function assertStoreAction(s: Session, money = false) {
  if (money && s.store === DEMO_STORE && !config.paypalBase.includes("sandbox")) throw new KartError("The demo store can't move real money. Sign in as a verified store.", 403);
  rateLimit(`store:${s.uid}:${s.store}`, 30, MIN, "Too many store actions. Wait a minute and try again.");
}

export function storeOrderOwner(s: Session, orderId: string): string | null {
  if (s.store === DEMO_STORE) {
    // Demo store: only orders this browser placed as the demo shopper.
    const mine = eachTenant().find(([t]) => t === s.uid);
    return mine && mine[1].orders.some((o) => o.id === orderId) ? s.uid! : null;
  }
  return tenantOfOrder((o) => o.id === orderId && o.store === s.store);
}

/** Orders a store session can see. */
export function ordersForStore(s: Session) {
  const out = [];
  for (const [t, d] of eachTenant()) {
    if (t === PLATFORM) continue;
    if (s.store === DEMO_STORE ? t === s.uid : true) {
      const mine = d.orders.filter((o) => (s.store === DEMO_STORE || o.store === s.store) && o.status !== "created");
      const ids = new Set(mine.map((o) => o.id));
      out.push({ orders: mine, events: d.events.filter((e) => e.orderId && ids.has(e.orderId)), claims: d.claims.filter((c) => ids.has(c.orderId)) });
    }
  }
  return out;
}
