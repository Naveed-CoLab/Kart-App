import { AsyncLocalStorage } from "async_hooks";
import fs from "fs";
import path from "path";
import { config, now, uid } from "./config";
import type { DB, EventType, KartEvent, Order } from "./types";
import { DB_VERSION, emptyDb } from "./seed";
import { hasPg, pgFlush, pgLastError, pgLoadAll } from "./pg";

/**
 * Kart keeps a separate private store per shopper ("tenant" = the shopper's account id).
 * Each request runs inside `asTenant(id, fn)`, so db()/mutate() always mean "this shopper's data".
 * Stores read across shoppers, but only orders placed with their own store (see eachTenant / tenantOfOrder).
 */
const g = globalThis as unknown as { __kartDbs?: Map<string, DB>; __kartFlush?: Promise<void>; __kartLoaded?: boolean };
const als = new AsyncLocalStorage<string | null>();
/** The connected agent (MCP) an action is running for, so events and orders say who asked. */
const actorAls = new AsyncLocalStorage<{ id: string; label: string }>();
export const asActor = <T>(actor: { id: string; label: string }, fn: () => T) => actorAls.run(actor, fn);
export const currentActor = () => actorAls.getStore()?.label ?? null;
export const currentActorId = () => actorAls.getStore()?.id ?? null;
const dbs = () => (g.__kartDbs ??= new Map());
const dir = () => path.join(process.cwd(), config.dataDir, "tenants");
const safe = (t: string) => t.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
const file = (t: string) => path.join(dir(), `${safe(t)}.json`);

/** Run code as one shopper. */
export function asTenant<T>(tenant: string | null, fn: () => T): T {
  return als.run(tenant, fn);
}
export const currentTenant = () => als.getStore() ?? null;

/** Called once at server start (instrumentation.ts). Loads every shopper's data. */
export async function initDb() {
  if (g.__kartLoaded) return;
  if (hasPg()) {
    const all = await pgLoadAll(emptyDb, DB_VERSION);
    for (const [t, d] of all) dbs().set(t, d);
    // First run on Postgres: bring over anything saved locally before, so nothing is lost in the switch.
    let imported = 0;
    for (const [t, d] of readLocalFiles()) {
      if (all.has(t)) continue;
      dbs().set(t, d);
      await pgFlush(t, d);
      imported++;
    }
    console.log(`[db] Postgres ready: ${all.size + imported} shopper${all.size + imported === 1 ? "" : "s"}${imported ? ` (${imported} imported from ${config.dataDir})` : ""}`);
  } else {
    for (const [t, d] of readLocalFiles()) dbs().set(t, d);
    if (process.env.NODE_ENV === "production")
      console.warn(`[db] No DATABASE_URL: saving to ${config.dataDir} on this server's disk. On hosts with a temporary disk (Render, Railway…) data is lost on restart. Set DATABASE_URL.`);
  }
  g.__kartLoaded = true;
}

/** Shopper files saved in local mode. Older formats are upgraded in place, never dropped. */
function readLocalFiles(): [string, DB][] {
  const out: [string, DB][] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir()).filter((f) => f.endsWith(".json"));
  } catch {
    return out; // no data yet
  }
  for (const f of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir(), f), "utf8")) as DB & { tenant?: string };
      if (!parsed.tenant) continue;
      const { tenant, ...rest } = parsed;
      const base = emptyDb();
      out.push([tenant, { ...base, ...rest, rules: { ...base.rules, ...(rest.rules || {}) }, version: DB_VERSION } as DB]);
    } catch (e) {
      console.error(`[db] couldn't read ${f}`, e);
    }
  }
  return out;
}

function load(tenant: string | null): DB {
  if (!tenant) return emptyDb(); // signed-out or store pages: a blank, never-saved view
  const m = dbs();
  if (!m.has(tenant)) {
    if (hasPg() && !g.__kartLoaded) throw new Error("Database is still starting. Try again in a moment.");
    m.set(tenant, emptyDb());
  }
  return m.get(tenant)!;
}

function persist(tenant: string) {
  const d = dbs().get(tenant);
  if (!d) return;
  if (hasPg()) {
    g.__kartFlush = pgFlush(tenant, d);
    return;
  }
  try {
    fs.mkdirSync(dir(), { recursive: true });
    const tmp = file(tenant) + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ ...d, tenant }));
    fs.renameSync(tmp, file(tenant));
  } catch (e) {
    console.error("[db] persist failed", e);
  }
}

/** Wait until every change so far is safely in Postgres (API routes call this before responding). */
export async function flushDb() {
  if (!g.__kartFlush) return;
  try {
    await g.__kartFlush;
  } catch {
    /* reported below */
  }
  if (pgLastError()) throw new Error("Couldn't save to the database. Check your connection and try again.");
}

/** This shopper's data (read-only use). */
export function db(): DB {
  return load(currentTenant());
}

/** Change this shopper's data and save it. */
export function mutate<T>(fn: (d: DB) => T): T {
  const t = currentTenant();
  if (!t) throw new Error("Please sign in first.");
  const d = load(t);
  const out = fn(d);
  persist(t);
  return out;
}

/** Every shopper's data (for store dashboards and webhooks). */
export function eachTenant(): [string, DB][] {
  if (!hasPg() && !g.__kartLoaded) {
    // file mode before init: load lazily
    void initDb();
  }
  return [...dbs().entries()];
}

/** Which shopper an order belongs to. */
export function tenantOfOrder(match: (o: Order) => boolean): string | null {
  for (const [t, d] of eachTenant()) if (d.orders.some(match)) return t;
  return null;
}

export function logEvent(e: {
  type: EventType;
  reason: string;
  orderId?: string | null;
  amount?: number | null;
  rule?: string | null;
  ref?: string | null;
  agent?: string | null;
}): KartEvent {
  const ev: KartEvent = { id: uid("ev_"), createdAt: now(), agent: currentActor() || "Kart chat", ...e };
  mutate((d) => {
    d.events.unshift(ev);
    d.events = d.events.slice(0, 500);
  });
  return ev;
}

export function getOrder(id: string): Order | undefined {
  return db().orders.find((o) => o.id === id);
}

export function updateOrder(id: string, patch: Partial<Order>): Order {
  return mutate((d) => {
    const o = d.orders.find((x) => x.id === id);
    if (!o) throw new Error("order not found: " + id);
    Object.assign(o, patch);
    return { ...o };
  });
}

/** Captured spend this calendar month, net of refunds (PRD §10.1). */
export function monthSpent(): number {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  let total = 0;
  for (const o of db().orders) {
    if (!o.paidAt || new Date(o.paidAt) < start) continue;
    total += o.price - (o.credits || []).reduce((s, c) => s + c.amount, 0);
  }
  return Math.round(total * 100) / 100;
}
