import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { COOKIE, encodeSession } from "@/lib/session";
import { clerkOn } from "@/lib/clerk";

export const dynamic = "force-dynamic";

/** After a Clerk sign-in, turn the Clerk user into a signed Kart shopper session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const asStore = url.searchParams.get("as") === "store";
  const nextRaw = url.searchParams.get("next") || (asStore ? "/store/connect" : "/shop");
  // Same-site paths only: no "//host", no backslashes (browsers treat "/\\host" as another site).
  const okNext = /^\/(?![\/\\])[^\\\s]*$/.test(nextRaw) && (asStore ? nextRaw.startsWith("/store") : !nextRaw.startsWith("/store"));
  const next = okNext ? nextRaw : asStore ? "/store/connect" : "/shop";
  if (!clerkOn) return NextResponse.redirect(new URL("/login?as=shopper", url));
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL(`/login?as=${asStore ? "store" : "shopper"}&next=${encodeURIComponent(next)}`, url));
  const u = await currentUser();
  const name = u?.firstName || u?.username || u?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Shopper";
  const res = NextResponse.redirect(new URL(next, url));
  res.cookies.set(COOKIE, encodeSession(
      asStore
        ? { role: "store", name, uid: `c_${userId}`, store: null, clerkId: userId, iat: Date.now() }
        : { role: "shopper", name, uid: `c_${userId}`, clerkId: userId, iat: Date.now() },
    ), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
