import { mcpGet, mcpOptions, mcpPost } from "@/lib/mcpRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  return mcpPost(req, (await params).key);
}
export const GET = mcpGet;
export const OPTIONS = mcpOptions;
