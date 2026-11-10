import { NextResponse } from "next/server";
import { KartError } from "./orders";
import { PayPalError } from "./paypal";
import { asTenant, flushDb } from "./db";
import { getSession, tenantOf } from "./session";

export const ok = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

export async function handle(fn: () => Promise<unknown>) {
  try {
    const tenant = tenantOf(await getSession());
    const data = await asTenant(tenant, fn);
    await flushDb();
    return ok(data);
  } catch (e) {
    if (e instanceof SyntaxError) return ok({ error: "Request body must be valid JSON." }, { status: 400 });
    const known = e instanceof KartError || e instanceof PayPalError;
    const status = known ? (e as KartError).status : 500;
    console.error("[api]", (e as Error).message);
    // Only Kart's own messages reach the browser; anything unexpected (database, network) stays in the logs.
    return ok({ error: known ? (e as Error).message : "Something went wrong on Kart's side. Please try again." }, { status: status >= 400 ? status : 500 });
  }
}

/** Money routes only accept requests from Kart's own pages (blocks cross-site form posts). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers / server calls
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/** Run a route body as the signed-in shopper (for routes that don't use handle()). */
export async function asUser<T>(fn: () => Promise<T> | T): Promise<T> {
  return asTenant(tenantOf(await getSession()), fn);
}

/**
 * Redirect to a path on this same site. The Location header is relative on purpose: behind a
 * host's proxy (Render, etc.) the server sees its internal address (localhost:10000) in req.url,
 * so an absolute redirect built from it would send the browser to localhost.
 */
export function redirectTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}
