/**
 * Postgres storage (used when DATABASE_URL is set; otherwise Kart uses local JSON files).
 *
 * Table `kart_data (tenant, collection, id, data jsonb)`: one row per record, per shopper.
 * `tenant` is the shopper's account id, so every shopper has private orders, chats, events,
 * claims and spending rules. Kart keeps a write-through cache in memory and writes only
 * the rows that changed.
 */
import { Pool } from "pg";
import type { DB } from "./types";

type Hashes = Map<string, Map<string, string>>; // tenant → (collection|id → json)
const g = globalThis as unknown as { __pgPool?: Pool; __pgHash?: Hashes; __pgQueue?: Promise<void>; __pgError?: Error | null };

export const hasPg = () => !!process.env.DATABASE_URL;

export const pgPool = () => pool();

function pool() {
  if (!g.__pgPool) {
    const u = new URL(process.env.DATABASE_URL!);
    const local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
    // SSL is set here (verified certificates for hosted Postgres such as Neon), so drop the URL's ssl params.
    u.searchParams.delete("sslmode");
    u.searchParams.delete("channel_binding");
    g.__pgPool = new Pool({ connectionString: u.toString(), ssl: local ? undefined : true, max: 5 });
  }
  return g.__pgPool;
}

const ARRAYS = ["orders", "events", "claims", "watches"] as const;
const MAPS = ["chats", "products", "searchCache", "approvals", "stores", "agentKeys"] as const;

/** Flatten one shopper's store into (collection|id) → JSON rows. */
function rows(d: DB): Map<string, string> {
  const m = new Map<string, string>();
  m.set("rules|main", JSON.stringify(d.rules));
  m.set("meta|version", JSON.stringify(d.version ?? 0));
  for (const c of ARRAYS) for (const r of d[c] as { id: string }[]) m.set(`${c}|${r.id}`, JSON.stringify(r));
  for (const c of MAPS) for (const [id, v] of Object.entries((d[c] || {}) as Record<string, unknown>)) m.set(`${c}|${id}`, JSON.stringify(v));
  return m;
}

/** The last write error, if the most recent write failed. */
export const pgLastError = () => g.__pgError ?? null;

/** Load every shopper's data at startup. */
export async function pgLoadAll(empty: () => DB, version: number): Promise<Map<string, DB>> {
  const p = pool();
  await p.query(`create table if not exists kart_data (
    tenant text not null,
    collection text not null,
    id text not null,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (tenant, collection, id)
  )`);
  await p.query(`create index if not exists kart_data_orders_store on kart_data ((data->>'store')) where collection = 'orders'`);
  const { rows: rs } = await p.query<{ tenant: string; collection: string; id: string; data: unknown }>("select tenant, collection, id, data from kart_data");
  const byTenant = new Map<string, typeof rs>();
  for (const r of rs) {
    if (!byTenant.has(r.tenant)) byTenant.set(r.tenant, []);
    byTenant.get(r.tenant)!.push(r);
  }
  const out = new Map<string, DB>();
  g.__pgHash = new Map();
  for (const [tenant, list] of byTenant) {
    // Older data is kept and upgraded in place (missing fields fall back to defaults), never dropped.
    const d = empty();
    d.version = version;
    for (const r of list) {
      if (r.collection === "rules") d.rules = { ...d.rules, ...(r.data as object) };
      else if ((ARRAYS as readonly string[]).includes(r.collection)) (d[r.collection as (typeof ARRAYS)[number]] as unknown[]).push(r.data);
      else if ((MAPS as readonly string[]).includes(r.collection)) ((d[r.collection as (typeof MAPS)[number]] ??= {}) as Record<string, unknown>)[r.id] = r.data;
    }
    for (const c of ARRAYS) (d[c] as { createdAt?: string }[]).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    out.set(tenant, d);
    g.__pgHash.set(tenant, rows(d));
  }
  return out;
}

/** Write one shopper's changed rows and delete removed ones. Writes are serialized. */
export function pgFlush(tenant: string, d: DB): Promise<void> {
  const snapshot = rows(d);
  const run = async () => {
    const split = (k: string): [string, string] => {
      const i = k.indexOf("|");
      return [k.slice(0, i), k.slice(i + 1)];
    };
    if (!g.__pgHash) g.__pgHash = new Map();
    const prev = g.__pgHash.get(tenant) || new Map<string, string>();
    const upserts: [string, string, string][] = [];
    for (const [k, v] of snapshot) if (prev.get(k) !== v) upserts.push([...split(k), v]);
    const deletes = [...prev.keys()].filter((k) => !snapshot.has(k)).map(split);
    if (!upserts.length && !deletes.length) return;
    const c = await pool().connect();
    try {
      await c.query("begin");
      for (let i = 0; i < upserts.length; i += 200) {
        const chunk = upserts.slice(i, i + 200);
        const vals = chunk.map((_, j) => `($1, $${j * 3 + 2}, $${j * 3 + 3}, $${j * 3 + 4}::jsonb, now())`).join(",");
        await c.query(
          `insert into kart_data (tenant, collection, id, data, updated_at) values ${vals} on conflict (tenant, collection, id) do update set data = excluded.data, updated_at = now()`,
          [tenant, ...chunk.flat()],
        );
      }
      for (const [col, id] of deletes) await c.query("delete from kart_data where tenant = $1 and collection = $2 and id = $3", [tenant, col, id]);
      await c.query("commit");
      g.__pgHash.set(tenant, snapshot);
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  };
  // Writes stay in order. A failed write is retried with the next change (its rows are still "changed"),
  // and the request that caused it gets an error instead of a silent success.
  const job = (g.__pgQueue || Promise.resolve()).then(run);
  g.__pgQueue = job.then(
    () => {
      g.__pgError = null;
    },
    (e) => {
      g.__pgError = e;
      console.error("[pg] flush failed", e);
    },
  );
  return job;
}
