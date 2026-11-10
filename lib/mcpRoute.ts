import { resolveAgentKey } from "./agentKeys";
import { asActor, asTenant } from "./db";
import { handleRpc } from "./mcp";
import { clientIp, MIN, rateLimit } from "./rateLimit";

const MAX_BODY = 64_000;
const MAX_BATCH = 20;
const rpcError = (code: number, message: string, status: number) => Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: cors });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
};

/** MCP over streamable HTTP, stateless JSON mode. The agent key comes from the URL or an Authorization: Bearer header. */
export async function mcpPost(req: Request, keyFromPath?: string) {
  // Unknown keys are throttled per IP so keys can't be guessed by brute force (they're 192-bit anyway).
  try {
    rateLimit(`mcp:ip:${clientIp(req)}`, 240, MIN);
  } catch {
    return rpcError(-32000, "Too many requests.", 429);
  }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const agent = resolveAgentKey(keyFromPath || bearer);
  if (!agent) return rpcError(-32001, "Invalid, expired or revoked Kart agent key. Create one in Kart under Connected agents.", 401);
  try {
    rateLimit(`mcp:key:${agent.id}`, 60, MIN);
  } catch {
    return rpcError(-32000, "This agent is making too many requests. Slow down and try again.", 429);
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY) return rpcError(-32600, "Request too large.", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return rpcError(-32700, "Parse error", 400);
  }
  if (Array.isArray(body) && (body.length === 0 || body.length > MAX_BATCH)) return rpcError(-32600, `Batches must have 1 to ${MAX_BATCH} messages.`, 400);
  const run = async () => {
    if (Array.isArray(body)) {
      const out: object[] = [];
      for (const m of body) {
        const r = await handleRpc(agent, m); // one at a time: purchases are never raced
        if (r) out.push(r);
      }
      return out.length ? Response.json(out, { headers: cors }) : new Response(null, { status: 202, headers: cors });
    }
    const out = await handleRpc(agent, body as never);
    return out ? Response.json(out, { headers: cors }) : new Response(null, { status: 202, headers: cors });
  };
  return asTenant(agent.tenant, () => asActor({ id: agent.id, label: agent.label }, run));
}

export const mcpGet = () => Response.json({ name: "Kart MCP server", transport: "streamable-http (POST JSON-RPC)", docs: "Create a key in Kart → Connected agents." }, { status: 405, headers: { ...cors, Allow: "POST" } });
export const mcpOptions = () => new Response(null, { status: 204, headers: cors });
