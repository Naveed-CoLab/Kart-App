import { getSession } from "@/lib/session";
import { newChat } from "@/lib/agent";
import { db, flushDb } from "@/lib/db";
import { asUser, ok } from "@/lib/http";
import type { Chat } from "@/lib/types";

export const dynamic = "force-dynamic";

/** What the sidebar needs to show at a glance: is anything waiting for the shopper, or was something bought? */
function summary(c: Chat) {
  const waiting = c.ui.some((i) => i.kind === "approval" && i.state === "pending");
  const bought = c.ui.some((i) => i.kind === "order");
  const blocked = !bought && c.ui.some((i) => i.kind === "blocked");
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt || c.createdAt,
    agent: c.agent || null,
    pinned: !!c.pinned,
    status: waiting ? "waiting" : bought ? "bought" : blocked ? "blocked" : null,
  };
}

export async function GET() {
  return asUser(() => {
    const chats = Object.values(db().chats)
      .filter((c) => c.ui.length > 0)
      .map(summary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return ok({ chats });
  });
}
export async function POST() {
  if ((await getSession())?.role !== "shopper") return ok({ error: "Sign in as the shopper first." }, { status: 401 });
  return asUser(async () => {
    const c = newChat();
    await flushDb();
    return ok({ id: c.id });
  });
}
