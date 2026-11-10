import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const GATED = ["/shop", "/chat", "/orders", "/agents", "/insights", "/store"];

/** Routes called by other servers, not by Kart's own pages: they authenticate themselves. */
const EXTERNAL_API = ["/api/paypal/webhook", "/api/mcp"];

/**
 * Cross-site request check for every API call that changes something: it must come from Kart's own
 * pages (Origin or Referer on this host). Webhooks and MCP agents are exempt; they carry their own
 * proof (PayPal signature, agent key). This backs up the SameSite=Lax session cookie.
 */
function crossSite(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!path.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  if (EXTERNAL_API.some((p) => path === p || path.startsWith(p + "/"))) return false;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const from = req.headers.get("origin") || req.headers.get("referer");
  if (!from) return req.headers.get("sec-fetch-site") === "cross-site";
  try {
    return new URL(from).host !== host;
  } catch {
    return true;
  }
}

/** Page gating by role. API routes check the signed Kart session themselves (lib/session.ts). */
function gate(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (crossSite(req)) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
  if (!GATED.some((p) => path === p || path.startsWith(p + "/"))) return NextResponse.next();
  const raw = req.cookies.get("kart_session")?.value;
  let role: string | null = null;
  try {
    const s = raw ? JSON.parse(atob(raw.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))) : null;
    // Shopper sessions from before per-account data have no account id: ask them to sign in again.
    role = s && s.uid ? s.role : null;
  } catch {
    role = null;
  }
  const needs = path.startsWith("/store") ? "store" : "shopper";
  if (role !== needs) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?as=${needs}&next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// With Clerk keys, Clerk's middleware runs first (needed for its sign-in), then Kart's role gate.
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? clerkMiddleware((_, req) => gate(req)) : gate;

export const config = {
  matcher: ["/((?!_next|brand|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)", "/(api|trpc)(.*)"],
};
