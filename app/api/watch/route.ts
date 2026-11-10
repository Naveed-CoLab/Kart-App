import { requireRole } from "@/lib/session";
import { currentPrice } from "@/lib/channel3";
import { db, logEvent, mutate } from "@/lib/db";
import { handle } from "@/lib/http";
import { decide } from "@/lib/guard";
import { autoBuy, KartError, pushChatItem } from "@/lib/orders";
import { money, uid } from "@/lib/config";

/** Kart Watch "check now": re-price on Channel3, then buy within the rules. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireRole("shopper");
    const b = (await req.json()) as { watchId?: unknown; chatId?: unknown };
    if (typeof b.watchId !== "string") throw new KartError("watchId required");
    if (b.chatId !== undefined && b.chatId !== null && typeof b.chatId !== "string") throw new KartError("Invalid chatId");
    const w = db().watches.find((x) => x.id === b.watchId);
    if (!w || w.status !== "watching") throw new KartError("Watch not active", 404);
    const price = await currentPrice(w.productId);
    mutate((d) => {
      const x = d.watches.find((y) => y.id === w.id)!;
      x.lastPrice = price;
      if (d.products[w.productId]) d.products[w.productId].price = price;
    });
    if (price > w.targetPrice) return { bought: false, price, message: `Still $${money(price)} (target $${money(w.targetPrice)}).` };
    const g = decide(price);
    logEvent({ type: "watch", amount: price, rule: "Kart Watch", reason: `${w.title} hit $${money(price)} (target $${money(w.targetPrice)}). ${g.reason}` });
    if (g.decision === "auto" && db().rules.mandateActive) {
      const order = await autoBuy(w.productId, b.chatId as string | undefined);
      mutate((d) => {
        d.watches.find((y) => y.id === w.id)!.status = "bought";
      });
      pushChatItem(b.chatId as string | undefined, { id: uid("ui_"), kind: "order", order, auto: true });
      return { bought: true, price, order };
    }
    return { bought: false, price, needsApproval: true, message: `Price hit $${money(price)}. ${g.reason}` };
  });
}
