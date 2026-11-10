/**
 * PayPal Agent Toolkit integration.
 * - Write tools (create_shipment_tracking, create_refund) run ONLY from server routes, after the guard.
 * - Read tools (get_order, get_shipment_tracking, get_refund) are exposed to the Claude agent.
 * Falls back to direct REST if the toolkit call fails, so the demo never breaks.
 */
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { config, hasPayPal } from "./config";
import { refundCapture } from "./paypal";

const g = globalThis as unknown as { __ppToolkit?: PayPalAgentToolkit };

function toolkit() {
  if (!g.__ppToolkit) {
    g.__ppToolkit = new PayPalAgentToolkit({
      clientId: config.paypalClientId,
      clientSecret: config.paypalSecret,
      configuration: {
        actions: {
          orders: { get: true },
          shipment: { create: true, get: true },
          payments: { createRefund: true, getRefunds: true },
        },
        context: { sandbox: config.paypalBase.includes("sandbox") },
      },
    });
  }
  return g.__ppToolkit;
}

async function run(tool: string, args: Record<string, unknown>): Promise<any> {
  const tools = toolkit().getTools() as Record<string, { execute?: (a: unknown, o?: unknown) => Promise<unknown> }>;
  const t = tools[tool];
  if (!t?.execute) throw new Error(`Agent Toolkit tool ${tool} not available`);
  const out = await t.execute(args, { toolCallId: "kart", messages: [] });
  if (typeof out === "string") {
    try {
      return JSON.parse(out);
    } catch {
      return { raw: out };
    }
  }
  return out;
}

export async function addShipmentTracking(captureId: string, trackingNumber: string, carrier = "USPS", status: "SHIPPED" | "DELIVERED" = "SHIPPED") {
  try {
    const r = await run("create_shipment_tracking", { transaction_id: captureId, tracking_number: trackingNumber, carrier, status });
    if (r?.error || r?.name === "INVALID_REQUEST") throw new Error(JSON.stringify(r).slice(0, 200));
    return { via: "agent-toolkit", trackingNumber, result: r };
  } catch (e) {
    console.warn("[toolkit] shipment tracking failed:", (e as Error).message);
    return { via: "skipped", trackingNumber, error: (e as Error).message };
  }
}

export async function updateShipmentDelivered(captureId: string, trackingNumber: string) {
  try {
    const tools = toolkit().getTools() as Record<string, unknown>;
    if (!tools["update_shipment_tracking"]) return { via: "skipped" };
    return { via: "agent-toolkit", result: await run("update_shipment_tracking", { transaction_id: captureId, tracking_number: trackingNumber, status: "DELIVERED" }) };
  } catch (e) {
    return { via: "skipped", error: (e as Error).message };
  }
}

/** Refund through the Agent Toolkit, falling back to REST. Returns the refund id. */
export async function refund(captureId: string, amount?: number, note?: string): Promise<{ id: string; via: string }> {
  try {
    const args: Record<string, unknown> = { capture_id: captureId };
    if (amount !== undefined) args.amount = { currency_code: "USD", value: amount.toFixed(2) };
    if (note) args.note_to_payer = note.slice(0, 255);
    const r = await run("create_refund", args);
    const id = r?.id || r?.refund_id;
    if (!id) throw new Error("no refund id: " + JSON.stringify(r).slice(0, 200));
    return { id, via: "agent-toolkit" };
  } catch (e) {
    console.warn("[toolkit] refund failed, using REST:", (e as Error).message);
    const r = await refundCapture(captureId, amount, note);
    return { id: r.id, via: "rest" };
  }
}

/** Read-only lookups the agent may call. */
export async function readTool(name: "get_order" | "get_shipment_tracking", args: Record<string, unknown>) {
  if (!hasPayPal()) return { error: "PayPal isn't set up" };
  try {
    return await run(name, args);
  } catch (e) {
    return { error: (e as Error).message };
  }
}
