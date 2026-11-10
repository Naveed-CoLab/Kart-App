import crypto from "crypto";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/http";
import { COOKIE, encodeSession, getSession, type Session } from "@/lib/session";
import { DEMO_STORE, getStore, normalizeDomain } from "@/lib/stores";
import { clientIp, HOUR, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
const clerkOn = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function GET() {
  return NextResponse.json({ session: await getSession() });
}

/**
 * Sign-in:
 *  { role: "shopper" }                 demo shopper (this browser's private demo account)
 *  { role: "store", demo: true }       demo store: shows the orders this browser placed as the demo shopper
 *  { role: "store" }                   store owner without Clerk (local dev only); with Clerk, owners sign in via /api/session/clerk?as=store
 *  { role: "store", store: "x.com" }   open a store the signed-in owner has verified
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  try {
    // Each new demo account is free: limit how fast one address can make them.
    rateLimit(`session:${clientIp(req)}`, 30, HOUR, "Too many sign-ins from this network. Try again later.");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 429 });
  }
  const b = await req.json().catch(() => ({}));
  const demoId = req.headers.get("cookie")?.match(/(?:^|;\s*)kart_demo=([a-zA-Z0-9_-]+)/)?.[1] || `d_${crypto.randomBytes(9).toString("base64url")}`;
  const current = await getSession();
  let s: Session;
  if (b.role === "store" && b.store) {
    const domain = normalizeDomain(String(b.store));
    const owner = current?.uid;
    const rec = getStore(domain);
    if (!owner || current?.role !== "store") return NextResponse.json({ error: "Sign in as a store owner first." }, { status: 401 });
    if (!rec || rec.ownerUid !== owner) return NextResponse.json({ error: "You haven't claimed this store." }, { status: 403 });
    if (!rec.verified) return NextResponse.json({ error: "Verify that you own this domain first." }, { status: 403 });
    s = { role: "store", name: domain, uid: owner, store: domain, clerkId: current.clerkId, iat: Date.now() };
  } else if (b.role === "store" && b.demo) {
    // The demo store shows the orders of the shopper this browser was just signed in as (demo shopper
    // or a Clerk account), taken from the signed session, never from anything the browser sends.
    const shopperUid = current?.role === "shopper" ? current.uid : current?.role === "store" && current.store === DEMO_STORE ? current.uid : demoId;
    s = { role: "store", name: "Demo store", uid: shopperUid || demoId, store: DEMO_STORE, iat: Date.now() };
  } else if (b.role === "store") {
    if (clerkOn) return NextResponse.json({ error: "Store owners sign in with their account." }, { status: 400 });
    s = { role: "store", name: "Store owner", uid: demoId, store: null, iat: Date.now() };
  } else {
    // Each browser gets its own private demo account, kept for a year so a judge can come back to it.
    s = { role: "shopper", name: "Demo shopper", uid: demoId, iat: Date.now() };
  }
  const res = NextResponse.json({ session: s });
  res.cookies.set(COOKIE, encodeSession(s), { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
  res.cookies.set("kart_demo", demoId, { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
