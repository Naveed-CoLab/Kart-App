import { auth, currentUser } from "@clerk/nextjs/server";
import { COOKIE, encodeSession } from "@/lib/session";
import { clerkOn } from "@/lib/clerk";
import { redirectTo } from "@/lib/http";

export const dynamic = "force-dynamic";

/** After a Clerk sign-in, turn the Clerk user into a signed Kart shopper session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const asStore = url.searchParams.get("as") === "store";
  const nextRaw = url.searchParams.get("next") || (asStore ? "/store/connect" : "/shop");
  // Same-site paths only: no "//host", no backslashes (browsers treat "/\\host" as another site).
  const okNext = /^\/(?![\/\\])[^\\\s]*$/.test(nextRaw) && (asStore ? nextRaw.startsWith("/store") : !nextRaw.startsWith("/store"));
  const next = okNext ? nextRaw : asStore ? "/store/connect" : "/shop";
  if (!clerkOn) return redirectTo("/login?as=shopper");
  const { userId } = await auth();
  if (!userId) return redirectTo(`/login?as=${asStore ? "store" : "shopper"}&next=${encodeURIComponent(next)}`);
  const u = await currentUser();
  const name = u?.firstName || u?.username || u?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Shopper";
  const res = redirectTo(next);
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
