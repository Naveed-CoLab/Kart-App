/**
 * PayPal REST (sandbox) client: Orders v2 (+ payee, + vault), Payouts, Refunds, webhook verification.
 *
 * Money model (Kart Guarantee):
 *  - The shopper's PayPal pays the STORE directly (Orders v2 `payee`), so Kart never holds funds.
 *  - If PayPal refuses a direct-payee order (e.g. vault charges), Kart captures and pays the store
 *    immediately with Payouts, so the store is still paid right away.
 *  - Problems are fixed by Kart paying the shopper back at once (Payouts or capture refund), then recovering from the store.
 *
 * Requires PayPal sandbox (or live) credentials; calls fail with a clear setup error otherwise.
 */
import { config, hasPayPal, money } from "./config";

type Token = { value: string; exp: number };
const g = globalThis as unknown as { __ppToken?: Token };

export class PayPalError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

export function requirePayPal() {
  if (!hasPayPal()) throw new PayPalError("PayPal isn't set up: add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env.local and restart.", 503);
}

async function accessToken(): Promise<string> {
  requirePayPal();
  if (g.__ppToken && g.__ppToken.exp > Date.now() + 60_000) return g.__ppToken.value;
  const res = await fetch(`${config.paypalBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${config.paypalClientId}:${config.paypalSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok) throw new PayPalError(j.error_description || "PayPal auth failed", res.status, j);
  g.__ppToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export async function pp<T = any>(path: string, init: { method?: string; body?: unknown; requestId?: string } = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${config.paypalBase}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await res.text();
  const j = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = j?.details?.[0];
    const msg = detail ? `${detail.issue}: ${detail.description || ""}` : j.message || res.statusText;
    throw new PayPalError(`PayPal ${init.method || "GET"} ${path} failed: ${msg}`, res.status, j);
  }
  return j as T;
}

export type CaptureResult = {
  paypalOrderId: string;
  captureId: string;
  status: string;
  vaultId?: string | null;
  customerId?: string | null;
  payerEmail?: string | null;
  payerName?: string | null;
  shipTo?: string | null;
};

function formatAddress(sh: any): string | null {
  const a = sh?.address;
  if (!a) return null;
  return [sh?.name?.full_name, a.address_line_1, a.admin_area_2, a.admin_area_1, a.postal_code].filter(Boolean).join(", ");
}

function parseCapture(j: any): CaptureResult {
  const cap = j?.purchase_units?.[0]?.payments?.captures?.[0];
  const ppSrc = j?.payment_source?.paypal;
  return {
    paypalOrderId: j.id,
    captureId: cap?.id,
    status: cap?.status || j.status,
    vaultId: ppSrc?.attributes?.vault?.id ?? null,
    customerId: ppSrc?.attributes?.vault?.customer?.id ?? null,
    payerEmail: ppSrc?.email_address ?? j?.payer?.email_address ?? null,
    payerName: ppSrc?.name?.given_name ?? j?.payer?.name?.given_name ?? null,
    shipTo: formatAddress(j?.purchase_units?.[0]?.shipping),
  };
}

function unit(ref: string, amount: number, description: string, payee?: string | null) {
  return {
    reference_id: ref,
    custom_id: ref,
    description: description.slice(0, 120),
    amount: { currency_code: "USD", value: money(amount) },
    // payee is a PayPal email, or "merchant:<id>" for a store connected through PayPal partner sign-up
    ...(payee ? { payee: payee.startsWith("merchant:") ? { merchant_id: payee.slice(9) } : { email_address: payee } } : {}),
  };
}

/**
 * PayPal wallet checkout settings. `landing_page: "LOGIN"` opens the PayPal login screen instead of
 * the "pay with debit or credit card / create account" (guest) page, so PayPal users just log in and pay.
 */
const paypalSource = (vault: boolean) => ({
  paypal: {
    ...(vault ? { attributes: { vault: { store_in_vault: "ON_SUCCESS", usage_type: "MERCHANT", customer_type: "CONSUMER" } } } : {}),
    experience_context: {
      brand_name: "Kart",
      landing_page: "LOGIN",
      return_url: `${config.appUrl}/orders`,
      cancel_url: `${config.appUrl}/orders`,
      shipping_preference: "GET_FROM_FILE",
      user_action: "PAY_NOW",
    },
  },
});

/**
 * Create a buyer-approved order (JS SDK popup). Tries, in order:
 *  vault (Kart merchant) → payee → plain (Kart merchant).
 * Saving PayPal (vault) must be on Kart's own merchant account: PayPal accepts vault+payee orders but
 * silently skips the vault, so the first, saving payment goes to Kart and Kart pays the store at once via Payouts.
 */
export async function createOrder(opts: { ref: string; amount: number; description: string; payee?: string | null; saveToVault?: boolean }) {
  requirePayPal();
  const attempts: { vault: boolean; payee: boolean }[] = [];
  if (opts.saveToVault) attempts.push({ vault: true, payee: false });
  if (opts.payee) attempts.push({ vault: false, payee: true });
  attempts.push({ vault: false, payee: false });
  let lastErr: unknown;
  for (const a of attempts) {
    try {
      const j = await pp("/v2/checkout/orders", {
        method: "POST",
        requestId: `create-${opts.ref}-${a.vault ? "v" : ""}${a.payee ? "p" : ""}`,
        body: {
          intent: "CAPTURE",
          purchase_units: [unit(opts.ref, opts.amount, opts.description, a.payee ? opts.payee : null)],
          payment_source: paypalSource(a.vault),
        },
      });
      return { id: j.id as string, vaultRequested: a.vault, merchant: (a.payee ? "store" : "kart") as "store" | "kart" };
    } catch (e) {
      lastErr = e;
      console.warn(`[paypal] create order (vault=${a.vault}, payee=${a.payee}) failed:`, (e as Error).message);
    }
  }
  throw lastErr;
}

export async function captureOrder(paypalOrderId: string): Promise<CaptureResult> {
  const j = await pp(`/v2/checkout/orders/${paypalOrderId}/capture`, { method: "POST", body: {}, requestId: `cap-${paypalOrderId}` });
  return parseCapture(j);
}

/** Merchant-initiated payment with the saved PayPal wallet (no popup). Tries paying the store directly first. */
export async function chargeVault(opts: { ref: string; amount: number; description: string; vaultId: string; payee?: string | null }): Promise<CaptureResult & { merchant: "store" | "kart" }> {
  const tryCharge = async (payee: string | null | undefined) => {
    const j = await pp("/v2/checkout/orders", {
      method: "POST",
      requestId: `auto-${opts.ref}-${payee ? "p" : "k"}`,
      body: { intent: "CAPTURE", purchase_units: [unit(opts.ref, opts.amount, opts.description, payee)], payment_source: { paypal: { vault_id: opts.vaultId } } },
    });
    if (j.status === "COMPLETED" && j.purchase_units?.[0]?.payments?.captures?.length) return parseCapture(j);
    return captureOrder(j.id);
  };
  if (opts.payee) {
    try {
      return { ...(await tryCharge(opts.payee)), merchant: "store" };
    } catch (e) {
      console.warn("[paypal] vault charge to store payee failed, charging Kart:", (e as Error).message);
    }
  }
  return { ...(await tryCharge(null)), merchant: "kart" };
}

export async function refundCapture(captureId: string, amount?: number, note?: string) {
  const body: Record<string, unknown> = {};
  if (amount !== undefined) body.amount = { value: money(amount), currency_code: "USD" };
  if (note) body.note_to_payer = note.slice(0, 255);
  const j = await pp(`/v2/payments/captures/${captureId}/refund`, { method: "POST", body, requestId: `ref-${captureId}-${amount ?? "full"}-${Date.now()}` });
  return { id: j.id as string, status: j.status as string };
}

/** Send money from Kart's PayPal balance to any PayPal email (store payment or Kart Guarantee credit). */
export async function createPayout(opts: { ref: string; amount: number; note: string; receiver: string; subject?: string }) {
  if (!opts.receiver) throw new PayPalError("No PayPal email to pay", 400);
  const j = await pp("/v1/payments/payouts", {
    method: "POST",
    body: {
      sender_batch_header: { sender_batch_id: `kart-${opts.ref}-${Date.now()}`, email_subject: opts.subject || "Payment from Kart", email_message: opts.note.slice(0, 1000) },
      items: [{ recipient_type: "EMAIL", amount: { value: money(opts.amount), currency: "USD" }, receiver: opts.receiver, note: opts.note.slice(0, 4000), sender_item_id: opts.ref }],
    },
  });
  return { batchId: j.batch_header.payout_batch_id as string, status: j.batch_header.batch_status as string };
}

/**
 * PayPal partner sign-up for stores ("Connect with PayPal"). Returns the PayPal URL the store owner opens
 * to log into their business account and grant Kart permission. Needs partner access on the PayPal app.
 */
export async function createPartnerReferral(opts: { trackingId: string; email?: string | null; returnUrl: string }) {
  const j = await pp("/v2/customer/partner-referrals", {
    method: "POST",
    body: {
      tracking_id: opts.trackingId,
      ...(opts.email ? { email: opts.email } : {}),
      operations: [
        {
          operation: "API_INTEGRATION",
          api_integration_preference: {
            rest_api_integration: { integration_method: "PAYPAL", integration_type: "THIRD_PARTY", third_party_details: { features: ["PAYMENT", "REFUND"] } },
          },
        },
      ],
      products: ["EXPRESS_CHECKOUT"],
      legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
      partner_config_override: { return_url: opts.returnUrl },
    },
  });
  const url = (j.links || []).find((l: { rel: string }) => l.rel === "action_url")?.href;
  if (!url) throw new PayPalError("PayPal didn't return a sign-up link", 502, j);
  return url as string;
}

export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  if (!hasPayPal() || !config.paypalWebhookId) return false;
  const j = await pp("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: config.paypalWebhookId,
      webhook_event: event,
    },
  });
  return j.verification_status === "SUCCESS";
}
