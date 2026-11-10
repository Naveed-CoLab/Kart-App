"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type ClientSession = { role: "shopper" | "store"; name: string; uid?: string; store?: string | null } | null;
const Ctx = createContext<{ session: ClientSession; loaded: boolean; refresh: () => Promise<void> }>({ session: null, loaded: false, refresh: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ClientSession>(null);
  const [loaded, setLoaded] = useState(false);
  const path = usePathname();
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/session", { cache: "no-store" }).then((x) => x.json());
      setSession(r.session);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh, path]);
  return <Ctx.Provider value={{ session, loaded, refresh }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx).session;
export const useSessionState = () => useContext(Ctx);

export async function signIn(role: "shopper" | "store", store?: string) {
  const r = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, store }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Sign-in failed");
  return j.session;
}

export async function signOut() {
  await fetch("/api/session", { method: "DELETE" });
}
