/**
 * Small in-memory rate limiter (sliding window per key). Kart runs as one server process, so this
 * protects the expensive and money-moving routes: chat (Claude), the Insights AI, MCP agents,
 * demo sign-ups and store verification. Limits reset when the server restarts.
 */
import { KartError } from "./orders";

const g = globalThis as unknown as { __kartRate?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__kartRate ??= new Map<string, number[]>());

/** Throws a 429 KartError when `key` made more than `max` calls in the last `windowMs`. */
export function rateLimit(key: string, max: number, windowMs: number, message = "Too many requests. Please wait a moment and try again.") {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    throw new KartError(message, 429);
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 50_000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
}

/** Best-effort client IP (behind Render's proxy the first X-Forwarded-For entry). */
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();

export const MIN = 60_000;
export const HOUR = 60 * MIN;
