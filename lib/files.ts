/**
 * Photo storage (chat photos and damage-claim photos).
 *
 * With DATABASE_URL set, photos are stored in Postgres (`kart_files`) so they survive restarts and
 * redeploys on hosts with a temporary disk (Render, Railway…). The local disk copy is only a cache.
 * Without a database, photos live in DATA_DIR/uploads as before.
 */
import fs from "fs";
import path from "path";
import { config } from "./config";
import { hasPg, pgPool } from "./pg";

const dir = () => path.join(process.cwd(), config.dataDir, "uploads");
const NAME = /^img_[a-z0-9]+\.(png|jpeg|jpg|webp|gif)$/;
export const uploadName = (p: string) => path.basename(p);
const local = (name: string) => path.join(dir(), name);

let ready: Promise<unknown> | null = null;
const table = () =>
  (ready ??= pgPool().query(`create table if not exists kart_files (
    name text primary key,
    media_type text not null,
    bytes bytea not null,
    created_at timestamptz not null default now()
  )`));

function cache(name: string, bytes: Buffer) {
  try {
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(local(name), bytes);
  } catch {
    /* the cache is optional */
  }
}

/** Save a photo. Returns the path that is stored with the chat or claim. */
export async function putUpload(name: string, mediaType: string, bytes: Buffer): Promise<string> {
  if (!NAME.test(name)) throw new Error("bad upload name");
  if (hasPg()) {
    await table();
    await pgPool().query("insert into kart_files (name, media_type, bytes) values ($1, $2, $3) on conflict (name) do nothing", [name, mediaType, bytes]);
  }
  cache(name, bytes);
  return local(name);
}

/** Read a photo by its stored path or name; null if it doesn't exist. */
export async function readUpload(pathOrName: string): Promise<Buffer | null> {
  const name = uploadName(pathOrName);
  if (!NAME.test(name)) return null;
  try {
    return fs.readFileSync(local(name));
  } catch {
    /* not cached on this machine */
  }
  if (!hasPg()) return null;
  await table();
  const { rows } = await pgPool().query<{ bytes: Buffer }>("select bytes from kart_files where name = $1", [name]);
  if (!rows[0]) return null;
  cache(name, rows[0].bytes);
  return rows[0].bytes;
}
