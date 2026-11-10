/**
 * Channel3 product search (https://api.trychannel3.com/v1/search), normalized to Kart's Product shape.
 * Results are cached for 24h per query to save credits. There is no offline catalog: errors are surfaced.
 */
import { config, hasChannel3, now, round2 } from "./config";
import { currentTenant, db, mutate } from "./db";
import type { Offer, Product } from "./types";

const DAY = 86400000;

type C3Offer = {
  url?: string;
  domain?: string;
  price?: { price?: number; amount?: number; compare_at_price?: number | null; currency?: string };
  availability?: string;
  max_commission_rate?: number | null;
};
type C3Product = {
  id: string;
  title: string;
  description?: string;
  brands?: { id?: string; name?: string }[];
  brand_name?: string;
  images?: { url?: string; cleaned_url?: string; is_main_image?: boolean }[];
  image_url?: string;
  offers?: C3Offer[];
  ratings?: { value?: number; count?: number } | null;
  key_features?: string[];
};

export function normalize(p: C3Product): Product | null {
  const offers = (p.offers || [])
    .map((o) => ({ ...o, _price: o.price?.price ?? o.price?.amount }))
    .filter((o) => typeof o._price === "number" && (!o.availability || /instock|limited/i.test(o.availability)));
  offers.sort((a, b) => (a._price as number) - (b._price as number));
  const offer = offers[0];
  if (!offer) return null;
  const img = p.images?.find((i) => i.is_main_image) || p.images?.[0];
  const compare = offer.price?.compare_at_price;
  const host = (o: C3Offer) => o.domain || (o.url ? new URL(o.url).hostname.replace(/^www\./, "") : "store");
  // One line per store (cheapest offer from each), so the shopper sees the whole market for this exact product.
  const seen = new Set<string>();
  const all: Offer[] = [];
  for (const o of offers) {
    const store = host(o);
    if (seen.has(store)) continue;
    seen.add(store);
    all.push({ store, price: round2(o._price as number), url: o.url || null });
  }
  return {
    id: p.id,
    title: p.title,
    brand: p.brands?.[0]?.name || p.brand_name,
    store: host(offer),
    price: round2(offer._price as number),
    compareAt: compare && compare > (offer._price as number) ? round2(compare) : null,
    rating: p.ratings?.value != null ? Math.round(p.ratings.value * 10) / 10 : null,
    reviews: p.ratings?.count ?? null,
    image: img?.cleaned_url || img?.url || p.image_url || null,
    url: offer.url || null,
    features: (p.key_features || []).slice(0, 5),
    description: p.description?.slice(0, 400),
    source: "channel3",
    offers: all.slice(0, 6),
    commission: typeof offer.max_commission_rate === "number" && offer.max_commission_rate > 0 ? offer.max_commission_rate : null,
  };
}

function cacheProducts(list: Product[]) {
  mutate((d) => {
    for (const p of list) d.products[p.id] = { ...p, fetchedAt: now() };
  });
}

export function getProduct(id: string): Product | undefined {
  return db().products[id];
}

export class Channel3Error extends Error {}

async function c3(path: string, init?: RequestInit) {
  if (!hasChannel3()) throw new Channel3Error("Product search isn't set up: add CHANNEL3_API_KEY to .env.local and restart.");
  const res = await fetch(`https://api.trychannel3.com${path}`, {
    ...init,
    // x-user-id attributes clicks and sales to this shopper in Channel3 reporting.
    headers: { "x-api-key": config.channel3Key, "Content-Type": "application/json", ...(currentTenant() ? { "x-user-id": currentTenant()! } : {}), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Channel3Error(`Channel3 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function searchProducts(query: string, maxPrice?: number, minPrice?: number): Promise<{ products: Product[]; source: string }> {
  const key = `${query.trim().toLowerCase()}|${maxPrice ?? ""}|${minPrice ?? ""}`;
  const cached = db().searchCache[key];
  if (cached && Date.now() - new Date(cached.at).getTime() < DAY) {
    const prods = cached.ids.map((id) => db().products[id]).filter(Boolean) as Product[];
    if (prods.length) return { products: prods, source: "channel3 (cached)" };
  }
  const filters: Record<string, unknown> = { availability: ["InStock"] };
  if (maxPrice !== undefined || minPrice !== undefined) filters.price = { ...(minPrice !== undefined ? { min_price: minPrice } : {}), ...(maxPrice !== undefined ? { max_price: maxPrice } : {}) };
  const j = await c3("/v1/search", { method: "POST", body: JSON.stringify({ query, limit: 12, filters, config: { mode: "agentic", country: "US", currency: "USD" } }) });
  const raw: C3Product[] = Array.isArray(j) ? j : j.products || [];
  const products = raw
    .map(normalize)
    .filter((p): p is Product => !!p && (maxPrice === undefined || p.price <= maxPrice))
    .slice(0, 8);
  cacheProducts(products);
  mutate((d) => {
    d.searchCache[key] = { ids: products.map((p) => p.id), at: now() };
  });
  return { products, source: "channel3" };
}

/** Re-check a product's current price on Channel3 (Price Guard / Kart Watch). */
export async function currentPrice(productId: string): Promise<number> {
  const p = getProduct(productId);
  if (!p) throw new Channel3Error("Unknown product");
  try {
    const n = normalize(await c3(`/v1/products/${encodeURIComponent(productId)}`));
    if (n) {
      cacheProducts([n]);
      return n.price;
    }
  } catch (e) {
    if (e instanceof Channel3Error && /isn't set up/.test(e.message)) throw e;
  }
  // Fallback: search by title and match the same product id.
  const j = await c3("/v1/search", { method: "POST", body: JSON.stringify({ query: p.title, limit: 10, filters: { availability: ["InStock"] } }) });
  const raw: C3Product[] = Array.isArray(j) ? j : j.products || [];
  const match = raw.find((r) => r.id === productId);
  const n = match ? normalize(match) : null;
  if (!n) throw new Channel3Error("Channel3 couldn't find this product right now.");
  cacheProducts([n]);
  return n.price;
}

/**
 * Live check right before paying: fetch the product again from Channel3 and pick the cheapest store
 * that has it in stock now. Returns null when no store has it in stock.
 */
export async function liveProduct(productId: string): Promise<Product | null> {
  const raw = (await c3(`/v1/products/${encodeURIComponent(productId)}`)) as C3Product;
  const n = normalize(raw);
  if (n) cacheProducts([{ ...n, checkedAt: now() }]);
  return n ? { ...n, checkedAt: now() } : null;
}

/** Channel3 image search: find products that match a photo (base64 without the data: prefix). */
export async function searchByImage(base64: string, maxPrice?: number): Promise<{ products: Product[]; source: string }> {
  const filters: Record<string, unknown> = { availability: ["InStock"] };
  if (maxPrice !== undefined) filters.price = { max_price: maxPrice };
  const j = await c3("/v1/image-search", { method: "POST", body: JSON.stringify({ base64_image: base64, limit: 12, filters, segment: "AUTO", config: { country: "US", currency: "USD" } }) });
  const raw: C3Product[] = Array.isArray(j) ? j : j.products || [];
  const products = raw
    .map(normalize)
    .filter((p): p is Product => !!p && (maxPrice === undefined || p.price <= maxPrice))
    .slice(0, 8);
  cacheProducts(products);
  return { products, source: "channel3 image search" };
}
