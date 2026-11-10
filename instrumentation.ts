/** Runs once when the Kart server starts: connects Postgres and loads data before serving requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDb } = await import("./lib/db");
    await initDb();
  }
}
