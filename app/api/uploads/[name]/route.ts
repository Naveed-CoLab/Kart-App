import { readUpload } from "@/lib/files";
import { getSession, tenantOf } from "@/lib/session";
import { asTenant, db } from "@/lib/db";

const TYPES: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/** Claim and chat photos. Names are unguessable, and only the shopper who added a photo can open it. */
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await getSession())) return new Response("Sign in to see this photo.", { status: 401 });
  const { name } = await params;
  const m = name.match(/^img_[a-z0-9]+\.(png|jpeg|jpg|webp|gif)$/);
  if (!m) return new Response("bad name", { status: 400 });
  // Only the shopper whose chat or claim holds this photo can open it.
  const s = await getSession();
  const mine = s?.role === "shopper" && asTenant(tenantOf(s), () => { const d = db(); return JSON.stringify(d.chats).includes(name) || d.claims.some((c) => c.imagePath?.endsWith(name)); });
  if (!mine) return new Response("not found", { status: 404 });
  const bytes = await readUpload(name);
  if (!bytes) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": TYPES[m[1]], "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Content-Disposition": "inline" },
  });
}
