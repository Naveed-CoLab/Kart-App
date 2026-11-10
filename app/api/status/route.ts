import { config, hasAnthropic, hasChannel3, hasPayPal } from "@/lib/config";
import { ok } from "@/lib/http";
import { thinkingStatus } from "@/lib/agent";
import { hasPg } from "@/lib/pg";

export const dynamic = "force-dynamic";
export async function GET() {
  return ok({
    paypal: hasPayPal(),
    sandbox: config.paypalBase.includes("sandbox"),
    anthropic: hasAnthropic(),
    channel3: hasChannel3(),
    model: config.model,
    payouts: Boolean(config.storeEmail),
    webhook: Boolean(config.paypalWebhookId),
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || config.paypalClientId || null,
    feeRate: config.feeRate,
    shopperEmail: Boolean(config.shopperEmail),
    thinking: thinkingStatus(),
    db: hasPg() ? "postgres" : "local files",
  });
}
