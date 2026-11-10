import { asTenant, flushDb, logEvent, tenantOfOrder } from "@/lib/db";
import { verifyWebhook } from "@/lib/paypal";

/** PayPal webhooks: verify signature, log to the decision trail, and finalize async payouts. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 200_000) return Response.json({ error: "Payload too large" }, { status: 413 });
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  let verified = false;
  try {
    verified = await verifyWebhook(req.headers, event);
  } catch (e) {
    console.warn("[webhook] verify error", (e as Error).message);
  }
  // Only events PayPal signed reach a shopper's decision trail; anything else is dropped.
  if (!verified) return Response.json({ ok: false, verified: false }, { status: 401 });
  const type: string = event.event_type || "UNKNOWN";
  const r = event.resource || {};
  // Find which shopper's order this event is about.
  let match: ((x: import("@/lib/types").Order) => boolean) | null = null;
  if (type.startsWith("PAYMENT.PAYOUTSBATCH")) {
    const batchId = r.batch_header?.payout_batch_id;
    match = (x) => x.storePayoutBatchId === batchId || !!x.credits?.some((c) => c.ref === batchId);
  } else if (type.startsWith("PAYMENT.CAPTURE")) {
    const capId = type === "PAYMENT.CAPTURE.REFUNDED" ? r.links?.find((l: any) => l.rel === "up")?.href?.split("/").pop() : r.id;
    match = (x) => x.paypalCaptureId === capId || x.id === r.custom_id;
  }
  const owner = match ? tenantOfOrder(match) : null;
  if (!owner) return Response.json({ ok: true, verified, matched: false });
  return asTenant(owner, () => finish(event, type, r, verified, match!));
}

async function finish(event: any, type: string, r: any, verified: boolean, match: (x: import("@/lib/types").Order) => boolean) {
  const { db } = await import("@/lib/db");
  const orderId = db().orders.find(match)?.id || null;
  const amount = r.amount?.value ? Number(r.amount.value) : r.batch_header?.amount?.value ? Number(r.batch_header.amount.value) : null;
  logEvent({ type: "webhook", orderId, amount, rule: verified ? "Signature verified" : "Unverified", reason: `PayPal webhook ${type}`, ref: event.id });
  await flushDb();
  return Response.json({ ok: true, verified });
}
