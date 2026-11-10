/**
 * Claude for AG Studio's AI assistant.
 *
 * AG Studio ships no model of its own: its Agent Framework calls an adapter with an `AgLlmRequest`
 * (conversation items, instructions, tools, response format) and expects an `AgLlmResponse` back.
 * The browser-side adapter (components/insights/claudeAdapter.ts) posts that request here; this route
 * maps it to the Anthropic Messages API, calls Claude with Kart's server key, and maps the reply back.
 * The key never reaches the browser.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { config, hasAnthropic } from "@/lib/config";
import { getSession } from "@/lib/session";
import { anthropic } from "@/lib/vision";
import { HOUR, MIN, rateLimit } from "@/lib/rateLimit";

const MAX_BODY = 600_000; // characters of request JSON (conversation + tool schemas)

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Json = Record<string, any>;
const RESPOND = "kart_structured_response";

/** Studio's JSON Schemas are 2020-12; Claude accepts them as-is apart from a few meta keys. */
function cleanSchema(schema: unknown): Json {
  const s = JSON.parse(JSON.stringify(schema ?? { type: "object", properties: {} }));
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    delete n.$schema;
    delete n.$id;
    for (const v of Object.values(n)) walk(v);
  };
  walk(s);
  if (s.type !== "object") return { type: "object", properties: { value: s }, required: ["value"] };
  return s;
}

/** AG Studio conversation items → Claude messages (consecutive same-role turns are merged). */
function toMessages(input: Json[]): { system: string[]; messages: Anthropic.MessageParam[] } {
  const system: string[] = [];
  const messages: Anthropic.MessageParam[] = [];
  const push = (role: "user" | "assistant", block: Anthropic.ContentBlockParam) => {
    const last = messages[messages.length - 1];
    if (last && last.role === role) (last.content as Anthropic.ContentBlockParam[]).push(block);
    else messages.push({ role, content: [block] });
  };
  for (const item of input) {
    if (item.type === "message" && item.kind === "input") {
      const text = (item.content || [])
        .map((c: Json) => (c.type === "text" ? c.text : c.type === "file" ? `[file ${c.filename || ""}]` : "[image]"))
        .join("\n");
      if (item.role === "system") system.push(text);
      else if (text.trim()) push("user", { type: "text", text });
    } else if (item.type === "message" && item.role === "assistant") {
      const text = (item.content || []).map((c: Json) => (c.type === "text" ? c.text : c.refusal || "")).join("");
      if (text.trim()) push("assistant", { type: "text", text });
    } else if (item.type === "function_call") {
      let args: Json = {};
      try {
        args = JSON.parse(item.arguments || "{}");
      } catch {}
      push("assistant", { type: "tool_use", id: item.callId, name: item.name, input: args });
    } else if (item.type === "function_call_output") {
      push("user", { type: "tool_result", tool_use_id: item.callId, content: String(item.output ?? "") });
    } else if (item.type === "reasoning" && typeof item.id === "string" && item.id.startsWith("th:")) {
      // Claude's thinking, carried through Studio as a reasoning item (signature in the id).
      const thinking = (item.content || []).map((c: Json) => c.text).join("");
      push("assistant", { type: "thinking", thinking, signature: item.id.slice(3) } as Anthropic.ContentBlockParam);
    }
  }
  if (!messages.length || messages[0].role !== "user") messages.unshift({ role: "user", content: [{ type: "text", text: "Continue." }] });
  return { system, messages };
}

export async function POST(req: Request) {
  const s = await getSession();
  if (s?.role !== "shopper") return Response.json({ error: { message: "Sign in first." } }, { status: 401 });
  if (!hasAnthropic()) return Response.json({ error: { message: "The AI assistant needs ANTHROPIC_API_KEY in .env.local." } }, { status: 503 });

  try {
    rateLimit(`studio:m:${s.uid}`, 30, MIN, "The assistant is busy. Wait a moment and try again.");
    rateLimit(`studio:h:${s.uid}`, 400, HOUR, "You've reached the hourly assistant limit. Try again later.");
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message } }, { status: 429 });
  }
  let body: Json;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return Response.json({ error: { message: "That conversation is too long. Start a new chat." } }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: { message: "Request body must be JSON." } }, { status: 400 });
  }

  const { system, messages } = toMessages(body.input || []);
  const json = body.responseFormat?.type === "json";
  let tools: Anthropic.Tool[] = (body.tools || [])
    .filter((t: Json) => (t.kind ?? "client") !== "provided")
    .map((t: Json) => ({ name: t.name, description: t.description || "", input_schema: cleanSchema(t.parameters) as Anthropic.Tool.InputSchema }));
  let tool_choice: Anthropic.ToolChoice | undefined;
  if (json) {
    // Structured output: Claude answers by calling one tool whose input is the requested JSON.
    tools = [{ name: RESPOND, description: body.responseFormat.description || `Respond with ${body.responseFormat.name}`, input_schema: cleanSchema(body.responseFormat.schema) as Anthropic.Tool.InputSchema }];
    tool_choice = { type: "tool", name: RESPOND };
  } else if (tools.length) {
    const c = body.toolChoice;
    tool_choice = c === "required" ? { type: "any" } : c === "none" ? { type: "none" } : c && typeof c === "object" ? { type: "tool", name: c.name } : { type: "auto" };
  }

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: config.model,
    max_tokens: 4096,
    system: [body.instructions, ...system].filter(Boolean).join("\n\n") || undefined,
    messages,
    ...(tools.length ? { tools, tool_choice } : {}),
  };

  let res: Anthropic.Message;
  try {
    try {
      res = await anthropic().messages.create(params, { signal: req.signal });
    } catch (e) {
      // Thinking blocks are bound to the prompt they came from; if Claude rejects them, retry without them.
      if (!/thinking|signature/i.test((e as Error).message)) throw e;
      const stripped = params.messages.map(
        (m) =>
          ({
            ...m,
            content: Array.isArray(m.content) ? (m.content as Anthropic.ContentBlockParam[]).filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking") : m.content,
          }) as Anthropic.MessageParam,
      );
      res = await anthropic().messages.create({ ...params, messages: stripped }, { signal: req.signal });
    }
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message } }, { status: 502 });
  }

  const output: Json[] = [];
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (json) {
    const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === RESPOND);
    let value: unknown = call?.input ?? {};
    const rf = cleanSchema(body.responseFormat.schema);
    if (rf.properties?.value && Object.keys(rf.properties).length === 1 && body.responseFormat.schema?.type !== "object") value = (value as Json).value;
    output.push({ id: `msg_${res.id}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: JSON.stringify(value), annotations: [] }] });
  } else {
    for (const b of res.content) {
      if (b.type === "thinking") output.push({ id: `th:${b.signature}`, kind: "output", type: "reasoning", summary: [], content: [{ type: "text", text: b.thinking }] });
    }
    if (text) output.push({ id: `msg_${res.id}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text, annotations: [] }] });
    for (const b of res.content) {
      if (b.type === "tool_use") output.push({ id: `fc_${b.id}`, kind: "output", type: "function_call", callId: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}), status: "completed" });
    }
  }

  return Response.json({
    id: res.id,
    createdAt: Date.now(),
    status: res.stop_reason === "max_tokens" ? "incomplete" : "completed",
    ...(res.stop_reason === "max_tokens" ? { incompleteDetails: { reason: "max_output_tokens" } } : {}),
    output,
    usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, totalTokens: res.usage.input_tokens + res.usage.output_tokens },
    model: res.model,
  });
}
