import { getSession, tenantOf } from "@/lib/session";
import { runAgent } from "@/lib/agent";
import { asTenant, db, flushDb } from "@/lib/db";
import { saveUpload } from "@/lib/orders";
import { HOUR, MIN, rateLimit } from "@/lib/rateLimit";
import { KartError } from "@/lib/orders";
import type { UIItem } from "@/lib/types";

const MAX_TEXT = 4000;
const MAX_IMAGE = 8 * 1024 * 1024; // data URL length (~6 MB image)

export const runtime = "nodejs";
export const maxDuration = 120;

/** Streams UI items as NDJSON while the agent works. */
export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "shopper") return Response.json({ error: "Sign in as the shopper first." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; text?: unknown; image?: unknown };
  const chatId = typeof b.chatId === "string" ? b.chatId : "";
  const text = typeof b.text === "string" ? b.text.slice(0, MAX_TEXT) : "";
  const image = typeof b.image === "string" ? b.image : null;
  if (image && image.length > MAX_IMAGE) return Response.json({ error: "That photo is too large. Try one under 6 MB." }, { status: 413 });
  try {
    // Each message runs Claude: cap it per shopper so a demo account can't run up the bill.
    rateLimit(`chat:m:${session.uid}`, 12, MIN, "You're sending messages very fast. Wait a few seconds and try again.");
    rateLimit(`chat:h:${session.uid}`, 150, HOUR, "You've hit the hourly message limit. Try again later.");
  } catch (e) {
    return Response.json({ error: (e as KartError).message }, { status: 429 });
  }
  return asTenant(tenantOf(session), () => run(chatId, text, image));
}

function run(chatId: string, text: string, image?: string | null) {
  if (!db().chats[chatId]) return Response.json({ error: "chat not found" }, { status: 404 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        const img = image ? await saveUpload(image) : null;
        await runAgent({ chatId, text: text || "", image: img, emit: (item: UIItem) => send({ item }) });
        await flushDb();
        send({ done: true });
      } catch (e) {
        console.error("[chat]", e);
        send({ error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
