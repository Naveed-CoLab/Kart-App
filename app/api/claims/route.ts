import { requireRole } from "@/lib/session";
import { handle } from "@/lib/http";
import { fileClaim, KartError, saveUpload } from "@/lib/orders";
import { HOUR, MIN, rateLimit } from "@/lib/rateLimit";

export const maxDuration = 60;
const MAX_IMAGE = 8 * 1024 * 1024; // data URL length (~6 MB image)

/** Shopper files a damage claim with a photo; Claude inspects it, then Kart decides. */
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireRole("shopper");
    // Each claim runs Claude vision: cap it per shopper.
    rateLimit(`claims:m:${s.uid}`, 5, MIN, "Too many claims at once. Wait a minute and try again.");
    rateLimit(`claims:h:${s.uid}`, 20, HOUR, "You've reached the hourly claim limit. Try again later.");
    const b = (await req.json()) as { orderId?: unknown; image?: unknown; reason?: unknown };
    if (typeof b.orderId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(b.orderId)) throw new KartError("orderId required");
    if (typeof b.image !== "string" || !b.image) throw new KartError("Attach a photo of the item");
    if (b.image.length > MAX_IMAGE) throw new KartError("That photo is too large. Try one under 6 MB.", 413);
    const reason = typeof b.reason === "string" && b.reason.trim() ? b.reason.trim().slice(0, 500) : "Item arrived damaged";
    const img = await saveUpload(b.image);
    return await fileClaim({ orderId: b.orderId, reason, imagePath: img.path, mediaType: img.mediaType });
  });
}
