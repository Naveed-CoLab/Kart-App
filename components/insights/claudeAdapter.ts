// AG Studio LLM adapter for Claude. Studio calls executeTurn() with an AgLlmRequest; we post it to
// Kart's server (/api/ai/studio), which calls Claude with the server-side key and returns an
// AgLlmResponse. The reply is then replayed to Studio as AG-UI events (text and tool calls).
import type { AgAiEvent, AgLlmAdapter, AgLlmRequest, AgLlmResponse, AgLlmResponseHandler } from "ag-studio";

function* eventsFor(res: AgLlmResponse): Generator<AgAiEvent> {
  for (const item of res.output) {
    if (item.type === "message") {
      const text = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("");
      yield { type: "TEXT_MESSAGE_START", messageId: item.id, role: "assistant" } as AgAiEvent;
      if (text) yield { type: "TEXT_MESSAGE_CONTENT", messageId: item.id, delta: text } as AgAiEvent;
      yield { type: "TEXT_MESSAGE_END", messageId: item.id } as AgAiEvent;
    } else if (item.type === "function_call") {
      yield { type: "TOOL_CALL_START", toolCallId: item.callId, toolCallName: item.name } as AgAiEvent;
      yield { type: "TOOL_CALL_ARGS", toolCallId: item.callId, delta: item.arguments } as AgAiEvent;
      yield { type: "TOOL_CALL_END", toolCallId: item.callId } as AgAiEvent;
    }
  }
}

export function claudeAdapter(endpoint = "/api/ai/studio"): AgLlmAdapter {
  return {
    executeTurn(request: AgLlmRequest, options?: { signal?: AbortSignal }): AgLlmResponseHandler {
      const call = (async (): Promise<AgLlmResponse> => {
        const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: options?.signal });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error?.message || `Claude request failed (${r.status})`);
        return j as AgLlmResponse;
      })();
      // A failed turn is reported once, through `complete`; mark it observed for consumers that stop early.
      void call.catch(() => {});
      async function* stream(): AsyncGenerator<AgAiEvent> {
        let res: AgLlmResponse;
        try {
          res = await call;
        } catch {
          return;
        }
        yield* eventsFor(res);
      }
      const it = stream();
      return { stream: { [Symbol.asyncIterator]: () => it }, complete: call };
    },
  };
}
