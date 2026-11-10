import { db, flushDb, mutate } from "@/lib/db";
import { asUser, ok, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return asUser(() => {
    const c = db().chats[id];
    if (!c) return ok({ error: "not found" }, { status: 404 });
    // Refresh order snapshots inside order/claim cards so they show live status.
    const orders = new Map(db().orders.map((o) => [o.id, o]));
    const ui = c.ui.map((i) => (i.kind === "order" || i.kind === "claim" ? { ...i, order: orders.get(i.order.id) || i.order } : i));
    return ok({ id: c.id, title: c.title, agent: c.agent || null, pinned: !!c.pinned, ui });
  });
}

/** Rename or pin a chat. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return ok({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { title?: string; pinned?: boolean };
  return asUser(async () => {
    if (!db().chats[id]) return ok({ error: "not found" }, { status: 404 });
    const title = typeof b.title === "string" ? b.title.trim().slice(0, 80) : null;
    mutate((d) => {
      const c = d.chats[id];
      if (title) c.title = title;
      if (typeof b.pinned === "boolean") c.pinned = b.pinned;
    });
    await flushDb();
    return ok({ ok: true });
  });
}

/** Delete a chat. Orders made in it are kept (they live in My orders). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return ok({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  return asUser(async () => {
    if (!db().chats[id]) return ok({ error: "not found" }, { status: 404 });
    mutate((d) => {
      delete d.chats[id];
    });
    await flushDb();
    return ok({ ok: true });
  });
}
