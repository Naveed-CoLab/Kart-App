import { mcpGet, mcpOptions, mcpPost } from "@/lib/mcpRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same MCP server, with the key in an Authorization: Bearer header. */
export async function POST(req: Request) {
  return mcpPost(req);
}
export const GET = mcpGet;
export const OPTIONS = mcpOptions;
