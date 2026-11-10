import { createHash } from "crypto";

export const config = {
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
  paypalSecret: process.env.PAYPAL_CLIENT_SECRET || "",
  paypalBase: process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com",
  paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID || "",
  storeEmail: process.env.STORE_PAYPAL_EMAIL || "",
  /** Optional JSON map of store domain -> sandbox store PayPal email, e.g. {"bestbuy.com":"store1@..."} */
  storePayees: (() => {
    try {
      return JSON.parse(process.env.STORE_PAYEES || "{}") as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  })(),
  shopperEmail: process.env.SHOPPER_PAYPAL_EMAIL || "",
  channel3Key: process.env.CHANNEL3_API_KEY || "",
  /** Signs sessions and approval tokens. See signingSecret() below. */
  get approvalSecret() {
    return signingSecret();
  },
  feeRate: Number(process.env.KART_FEE_RATE || "0.05"),
  /** "demo" simulates placing the order on the store website (sandbox). */
  storeCheckout: (process.env.STORE_CHECKOUT === "live" ? "live" : "demo") as "demo" | "live",
  dataDir: process.env.DATA_DIR || ".data",
  appUrl: process.env.APP_URL || "http://localhost:3000",
};

/**
 * The HMAC secret for sessions and approval tokens. In production it must not be a public default:
 * use APPROVAL_SECRET, or derive one from server-only secrets that are already set. If none exist,
 * refuse to run rather than sign with a guessable key.
 */
let cachedSecret: string | null = null;
function signingSecret(): string {
  if (cachedSecret) return cachedSecret;
  const explicit = process.env.APPROVAL_SECRET;
  if (explicit && explicit.length >= 32) return (cachedSecret = explicit);
  if (process.env.NODE_ENV === "production") {
    const material = [process.env.CLERK_SECRET_KEY, process.env.PAYPAL_CLIENT_SECRET, process.env.DATABASE_URL, process.env.ANTHROPIC_API_KEY].filter(Boolean).join("|");
    if (!material) throw new Error("Set APPROVAL_SECRET (32+ random characters) before running Kart in production.");
    if (explicit) console.warn("[kart] APPROVAL_SECRET is shorter than 32 characters; using a derived secret instead.");
    return (cachedSecret = createHash("sha256").update("kart-signing|" + material).digest("hex"));
  }
  return (cachedSecret = explicit || "kart-dev-secret-change-me");
}

export const hasPayPal = () => Boolean(config.paypalClientId && config.paypalSecret);
export const hasAnthropic = () => Boolean(config.anthropicKey);
export const hasChannel3 = () => Boolean(config.channel3Key);

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const money = (n: number) => n.toFixed(2);
/** Unguessable ids (upload names, nonces, order ids): 72 bits from the platform CSPRNG. */
export const uid = (p = "") => {
  const b = new Uint8Array(9);
  globalThis.crypto.getRandomValues(b);
  return p + Array.from(b, (x) => (x % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
};
export const now = () => new Date().toISOString();

/** PayPal email that receives payment for a store (sandbox: your Store account). */
export const payeeFor = (store: string) => config.storePayees[store] || config.storeEmail || null;
