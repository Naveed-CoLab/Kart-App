/**
 * Sessions for the two sides of Kart: shoppers and stores.
 * A signed (HMAC) httpOnly cookie. Demo sign-in: one click as the shopper, or as a store.
 * In production this is where a real identity provider (PayPal Log In, Clerk, etc.) plugs in.
 */
import crypto from "crypto";
import { cookies } from "next/headers";
import { config } from "./config";
import { KartError } from "./orders";

export type Role = "shopper" | "store";
export type Session = { role: Role; name: string; uid?: string; store?: string | null; clerkId?: string; iat: number };
export const COOKIE = "kart_session";
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const sign = (p: string) => crypto.createHmac("sha256", config.approvalSecret).update("session|" + p).digest("base64url");

export function encodeSession(s: Session) {
  const p = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${p}.${sign(p)}`;
}

export function decodeSession(raw?: string | null): Session | null {
  if (!raw) return null;
  const [p, sig] = raw.split(".");
  if (!p || !sig) return null;
  const exp = sign(p);
  if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  try {
    const s = JSON.parse(Buffer.from(p, "base64url").toString()) as Session;
    // Every session must belong to an account (shopper or store owner) and expire after 30 days,
    // even if a browser keeps the cookie longer.
    if (!s.uid || (s.role !== "shopper" && s.role !== "store")) return null;
    if (!s.iat || Date.now() - s.iat > SESSION_MAX_AGE_MS || s.iat > Date.now() + 60_000) return null;
    return s;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(COOKIE)?.value);
}

/** Server-side role check for API routes. */
export async function requireRole(role: Role): Promise<Session> {
  const s = await getSession();
  if (!s) throw new KartError("Please sign in first.", 401);
  if (s.role !== role) throw new KartError(role === "store" ? "Only the store can do this. Sign in as the store." : "Only the shopper can do this. Sign in as the shopper.", 403);
  if (role === "store" && !s.store) throw new KartError("Finish setting up your store first.", 403);
  return s;
}

export const normalizeStore = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];

/** The shopper account a session belongs to (null for stores and signed-out visitors). */
export const tenantOf = (s: Session | null) => (s?.role === "shopper" && s.uid ? s.uid : null);

/** Store owner (signed in on the store side), whether or not a store is open yet. */
export async function requireStoreOwner(): Promise<Session> {
  const s = await getSession();
  if (!s || s.role !== "store" || !s.uid) throw new KartError("Please sign in as a store owner first.", 401);
  return s;
}

/** The demo store shows the orders this browser placed as the demo shopper. */
export const isDemoStore = (s: Session | null) => s?.role === "store" && s.store === "demo";
