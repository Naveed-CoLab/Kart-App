"use client";
import { useSession } from "./session";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Rules } from "@/lib/types";

export type Status = {
  paypal: boolean;
  sandbox: boolean;
  anthropic: boolean;
  channel3: boolean;
  model: string;
  payouts: boolean;
  webhook: boolean;
  clientId: string | null;
  feeRate: number;
  shopperEmail: boolean;
};

type Ctx = {
  status: Status | null;
  rules: Rules | null;
  monthSpent: number;
  refreshRules: () => Promise<void>;
  rulesOpen: boolean;
  setRulesOpen: (v: boolean) => void;
  chatsVersion: number;
  bumpChats: () => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

export async function api<T = any>(url: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(url, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || res.statusText);
  return j as T;
}

export const usd = (n: number | null | undefined) => (n == null ? "–" : `$${n.toFixed(2)}`);
/** Whole-dollar amounts without cents (for rule limits). */
export const usd0 = (n: number | null | undefined) => (n == null ? "–" : Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [monthSpent, setMonthSpent] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [chatsVersion, setChatsVersion] = useState(0);
  const refreshRules = useCallback(async () => {
    const r = await api<{ rules: Rules; monthSpent: number }>("/api/rules");
    setRules(r.rules);
    setMonthSpent(r.monthSpent);
  }, []);
  // Reload the shopper's rules whenever the signed-in account changes (sign in, sign out, switch).
  const sess = useSession();
  const account = sess?.uid ?? sess?.store ?? null;
  useEffect(() => {
    api<Status>("/api/status").then(setStatus).catch(() => {});
  }, []);
  useEffect(() => {
    refreshRules().catch(() => {});
    setChatsVersion((v) => v + 1);
  }, [refreshRules, account]);
  return (
    <AppCtx.Provider value={{ status, rules, monthSpent, refreshRules, rulesOpen, setRulesOpen, chatsVersion, bumpChats: () => setChatsVersion((v) => v + 1) }}>
      {children}
    </AppCtx.Provider>
  );
}
