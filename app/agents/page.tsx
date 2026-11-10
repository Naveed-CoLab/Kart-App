"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@lemonsqueezy/wedges";
import { AlertTriangle, Ban, Check, Clock, Copy, Gauge, KeyRound, ListOrdered, Lock, ShieldCheck, ShoppingBag, Zap } from "lucide-react";
import { api } from "@/components/app-context";
import { ClaudeMark } from "@/components/logos";
import { EmptyState, PageHeader, ago, useToast } from "@/components/ui";

type Agent = {
  id: string;
  label: string;
  hint: string;
  createdAt: string;
  lastUsedAt?: string | null;
  canBuy: boolean;
  canAutoBuy: boolean;
  monthlyBudget: number;
  expiresAt: string | null;
  expired: boolean;
  spentThisMonth: number;
  recent: { at: string; type: string; amount: number | null; text: string }[];
};
type Limits = { autoBuyUnder: number; monthlyCap: number };
const PRESETS = ["Claude Desktop", "Claude.ai", "ChatGPT", "Cursor"];
const EXPIRY = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["never", "Never"],
] as const;
const usd = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;

function CopyBlock({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="relative">
      <pre className="scrollbar-thin overflow-x-auto rounded-xl border border-line bg-[#0B1B3F] p-4 pr-12 font-mono text-[12.5px] leading-relaxed text-white/90">{text}</pre>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => {
          navigator.clipboard.writeText(text).catch(() => {});
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20"
      >
        {done ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-action" : "bg-line-strong"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function PermissionRow({ icon: Icon, title, text, children }: { icon: typeof Zap; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon size={16} className="shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium">{title}</p>
        <p className="text-[12px] text-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}

function AgentCard({ a, limits, onChanged }: { a: Agent; limits: Limits | null; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [budget, setBudget] = useState(String(a.monthlyBudget));
  const [confirm, setConfirm] = useState(false);
  const update = async (patch: object, msg?: string) => {
    try {
      await api("/api/agents", { update: a.id, ...patch });
      if (msg) toast({ tone: "success", title: msg });
      await onChanged();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't update the agent", text: (e as Error).message });
    }
  };
  const revoke = async () => {
    await api("/api/agents", { revoke: a.id });
    toast({ tone: "success", title: `${a.label} disconnected`, text: "Its key stopped working immediately." });
    await onChanged();
  };
  const pct = Math.min(100, (a.spentThisMonth / a.monthlyBudget) * 100);
  const expiresSoon = a.expiresAt && !a.expired && Date.parse(a.expiresAt) - Date.now() < 7 * 86_400_000;

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-sunken">{/claude/i.test(a.label) ? <ClaudeMark size={16} /> : <KeyRound size={16} className="text-muted" />}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14px] font-medium">
            {a.label}
            {a.expired ? (
              <span className="badge bg-danger-tint text-danger">Expired</span>
            ) : !a.canBuy ? (
              <span className="badge bg-sunken text-muted">Read only</span>
            ) : a.canAutoBuy ? (
              <span className="badge bg-success-tint text-success">Can pay on its own</span>
            ) : (
              <span className="badge bg-tint text-action">Asks before every buy</span>
            )}
          </p>
          <p className="text-[12.5px] text-muted">
            Key ending {a.hint}. {a.lastUsedAt ? `Last used ${ago(a.lastUsedAt)}.` : "Not used yet."}{" "}
            {a.expiresAt ? (a.expired ? "Expired." : `Expires ${new Date(a.expiresAt).toLocaleDateString()}.`) : "Never expires."}
          </p>
        </div>
        {confirm ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px] text-muted">Disconnect?</span>
            <Button size="sm" className="bg-danger" onClick={revoke}>
              Yes
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>
              No
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
            Disconnect
          </Button>
        )}
      </div>

      <div className="mt-3 grid gap-4 pl-12 lg:grid-cols-[1fr_260px]">
        <div className="divide-y divide-line rounded-xl border border-line px-3">
          <PermissionRow icon={ShoppingBag} title="Can ask to buy" text="Off means it can only search and read your orders.">
            <Toggle on={a.canBuy} label="Can ask to buy" onChange={(v) => update({ canBuy: v }, v ? "It can ask to buy again" : "It can no longer buy")} />
          </PermissionRow>
          <PermissionRow icon={Zap} title="Can pay on its own" text={`Pays with your saved PayPal for items up to ${limits ? usd(limits.autoBuyUnder) : "your auto-buy limit"}. Off: every purchase waits for your OK.`}>
            <Toggle on={a.canAutoBuy} disabled={!a.canBuy} label="Can pay on its own" onChange={(v) => update({ canAutoBuy: v }, v ? "It can now pay on its own" : "It will ask before every purchase")} />
          </PermissionRow>
          <div className="flex flex-wrap items-center gap-3 py-2.5">
            <Gauge size={16} className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">Monthly budget for this agent</p>
              <p className="text-[12px] text-muted">On top of your own {limits ? usd(limits.monthlyCap) : ""} monthly cap.</p>
            </div>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                update({ monthlyBudget: Number(budget) }, "Budget saved");
              }}
            >
              <span className="text-[13px] text-muted">$</span>
              <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Monthly budget" className="h-8 w-20 rounded-lg border border-line px-2 text-[13px] tabular-nums outline-none focus:border-action" />
              {Number(budget) !== a.monthlyBudget && (
                <Button size="sm" type="submit">
                  Save
                </Button>
              )}
            </form>
          </div>
          {(a.expired || expiresSoon) && (
            <div className="flex items-center gap-3 py-2.5">
              <Clock size={16} className="shrink-0 text-warn" />
              <p className="flex-1 text-[12.5px] text-warn">{a.expired ? "This key expired, so the agent can't do anything." : "This key expires soon."}</p>
              <Button size="sm" variant="outline" onClick={() => update({ extendDays: 30 }, "Key renewed for 30 days")}>
                Renew 30 days
              </Button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-sunken p-3">
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="text-muted">Spent this month</span>
              <span className="tabular-nums">
                <b className="text-ink">{usd(a.spentThisMonth)}</b> / {usd(a.monthlyBudget)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e3e8ef]">
              <div className={`h-full rounded-full ${pct > 85 ? "bg-danger" : "bg-action"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div>
            <p className="text-[12px] font-medium text-muted">Recent activity</p>
            {a.recent.length ? (
              <ul className="mt-1.5 space-y-1.5">
                {a.recent.map((r, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-snug">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${r.type === "blocked" ? "bg-danger" : r.type === "decision" ? "bg-action" : "bg-success"}`} />
                    <span className="min-w-0 text-muted">
                      {r.text} <span className="text-subtle">· {ago(r.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[12px] text-subtle">Nothing yet.</p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function AgentsPage() {
  const toast = useToast();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [label, setLabel] = useState("Claude Desktop");
  const [canBuy, setCanBuy] = useState(true);
  const [canAutoBuy, setCanAutoBuy] = useState(false);
  const [budget, setBudget] = useState("50");
  const [expires, setExpires] = useState<string>("30");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ url: string; key: string; label: string } | null>(null);
  const [tab, setTab] = useState<"desktop" | "remote" | "other">("desktop");
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ agents: Agent[]; limits: Limits }>("/api/agents");
    setAgents(r.agents);
    setLimits(r.limits);
  }, []);
  useEffect(() => {
    load().catch(() => setAgents([]));
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await api<{ key: string; url: string; agent: Agent }>("/api/agents", { create: { label, canBuy, canAutoBuy: canBuy && canAutoBuy, monthlyBudget: Number(budget), expiresInDays: expires } });
      setCreated({ url: r.url, key: r.key, label: r.agent.label });
      setTab(/desktop/i.test(r.agent.label) ? "desktop" : /claude\.ai|chatgpt/i.test(r.agent.label) ? "remote" : "other");
      await load();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't create a key", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const revokeAll = async () => {
    const r = await api<{ revoked: number }>("/api/agents", { revokeAll: true });
    toast({ tone: "success", title: `Disconnected ${r.revoked} agent${r.revoked === 1 ? "" : "s"}`, text: "Their keys stopped working immediately." });
    setConfirmAll(false);
    setCreated(null);
    await load();
  };

  // The key travels in a header (via an env var, which also avoids the Windows "spaces in args" issue), never in the URL.
  const desktopConfig = created
    ? JSON.stringify({ mcpServers: { kart: { command: "npx", args: ["-y", "mcp-remote", created.url.replace(/\/api\/mcp\/.*/, "/api/mcp"), "--header", "Authorization:${KART_AUTH}"], env: { KART_AUTH: `Bearer ${created.key}` } } } }, null, 2)
    : "";
  const isLocal = created?.url.includes("localhost");
  const active = agents?.filter((a) => !a.expired).length ?? 0;

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[960px] space-y-6 px-6 py-7">
        <PageHeader
          title="Connected agents"
          description="Let Claude, ChatGPT or any MCP-compatible agent shop for you through Kart. Each agent gets its own key, budget and permissions, on top of your spending rules."
        />

        <section className="grid gap-3 md:grid-cols-3">
          {[
            [Lock, "Least privilege", "New agents ask before every purchase and get their own budget. You decide what each one may do."],
            [ShieldCheck, "Your rules always win", "No agent can go over your max per item, your monthly cap, or its own budget. It never sees your PayPal."],
            [Ban, "Instant off switch", "Keys expire, and Disconnect stops an agent immediately. Every action shows up below and in Insights."],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Lock;
            return (
              <div key={t as string} className="card p-4">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <Icon size={15} className="text-action" /> {t as string}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{d as string}</p>
              </div>
            );
          })}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <p className="text-[15px] font-semibold">Connect an agent</p>
            <p className="mt-0.5 text-[13px] text-muted">Choose what this agent may do. You can change it any time.</p>
          </div>
          <form
            className="space-y-4 px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setLabel(p)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] ${label === p ? "border-action bg-tint text-action" : "border-line text-muted hover:text-ink"}`}
                >
                  {p.startsWith("Claude") && <ClaudeMark size={12} />} {p}
                </button>
              ))}
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} aria-label="Agent name" className="h-9 min-w-[160px] flex-1 rounded-lg border border-line px-3 text-[13.5px] outline-none focus:border-action" />
            </div>
            <div className="divide-y divide-line rounded-xl border border-line px-3">
              <PermissionRow icon={ShoppingBag} title="Can ask to buy" text="Off: search and read orders only.">
                <Toggle on={canBuy} label="Can ask to buy" onChange={setCanBuy} />
              </PermissionRow>
              <PermissionRow icon={Zap} title="Can pay on its own" text={`Up to ${limits ? usd(limits.autoBuyUnder) : "your auto-buy limit"} with saved PayPal. Recommended off: you confirm every purchase.`}>
                <Toggle on={canBuy && canAutoBuy} disabled={!canBuy} label="Can pay on its own" onChange={setCanAutoBuy} />
              </PermissionRow>
              <div className="flex flex-wrap items-center gap-3 py-2.5">
                <Gauge size={16} className="shrink-0 text-muted" />
                <p className="min-w-0 flex-1 text-[13.5px] font-medium">Monthly budget</p>
                <span className="text-[13px] text-muted">$</span>
                <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Monthly budget" className="h-8 w-20 rounded-lg border border-line px-2 text-[13px] tabular-nums outline-none focus:border-action" />
              </div>
              <div className="flex flex-wrap items-center gap-3 py-2.5">
                <Clock size={16} className="shrink-0 text-muted" />
                <p className="min-w-0 flex-1 text-[13.5px] font-medium">Key expires after</p>
                <div className="inline-flex rounded-lg bg-[#e9edf3] p-1 text-[12px]">
                  {EXPIRY.map(([v, t]) => (
                    <button type="button" key={v} onClick={() => setExpires(v)} className={`h-7 rounded-md px-2.5 font-medium ${expires === v ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={busy || !label.trim() || !(Number(budget) > 0)}>
                {busy ? "Creating…" : "Create key"}
              </Button>
            </div>
          </form>

          {created && (
            <div className="space-y-4 border-t border-line bg-bg px-5 py-5">
              <div>
                <p className="text-[13.5px] font-semibold">Your Kart key for {created.label}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-warn">
                  <AlertTriangle size={13} /> Shown only once. Anyone with it can act as this agent, so keep it private.
                </p>
                <div className="mt-2">
                  <CopyBlock text={created.key} />
                </div>
              </div>
              <div>
                <div role="tablist" className="inline-flex rounded-lg bg-[#e9edf3] p-1 text-[12.5px]">
                  {(
                    [
                      ["desktop", "Claude Desktop"],
                      ["remote", "Claude.ai / ChatGPT"],
                      ["other", "Other agents"],
                    ] as const
                  ).map(([k, t]) => (
                    <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-7 rounded-md px-3 font-medium ${tab === k ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                {tab === "desktop" && (
                  <div className="mt-3 space-y-2 text-[13px] text-muted">
                    <p>
                      In Claude Desktop, open <b className="text-ink">Settings → Developer → Edit config</b>, paste this into <span className="font-mono">claude_desktop_config.json</span>, save, and restart Claude. Needs Node.js. The key goes in a header, so it never appears in URLs or logs.
                    </p>
                    <CopyBlock text={desktopConfig} />
                    <p>Then ask Claude: “Find me running socks under $20 and buy the best one with Kart.”</p>
                  </div>
                )}
                {tab === "remote" && (
                  <div className="mt-3 space-y-2 text-[13px] text-muted">
                    <p>
                      These apps take a single link. In Claude.ai go to <b className="text-ink">Settings → Connectors → Add custom connector</b>; in ChatGPT, add an MCP connector (developer mode). Paste this link, which includes the key:
                    </p>
                    <CopyBlock text={created.url} />
                    {isLocal && <p className="rounded-lg bg-warn-tint px-3 py-2 text-warn">These apps connect from the internet, so they need Kart&apos;s public address. Use this once Kart is deployed (APP_URL set to your Render URL), or use Claude Desktop locally.</p>}
                  </div>
                )}
                {tab === "other" && (
                  <div className="mt-3 space-y-2 text-[13px] text-muted">
                    <p>Any MCP client with the streamable HTTP transport. Send the key as a Bearer token:</p>
                    <CopyBlock text={`URL: ${created.url.replace(/\/api\/mcp\/.*/, "/api/mcp")}\nAuthorization: Bearer ${created.key}`} />
                    <p>Tools: search_products, get_my_rules, buy_product, check_purchase, list_orders.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="text-[15px] font-semibold">
              Your agents {agents && <span className="font-normal text-muted">({active} active)</span>}
            </p>
            {!!agents?.length &&
              (confirmAll ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] text-muted">Disconnect all agents?</span>
                  <Button size="sm" className="bg-danger" onClick={revokeAll}>
                    Yes, disconnect all
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmAll(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button onClick={() => setConfirmAll(true)} className="text-[12.5px] font-medium text-danger hover:underline">
                  Disconnect all
                </button>
              ))}
          </div>
          {!agents ? (
            <div className="shimmer m-5 h-12 rounded-lg" />
          ) : !agents.length ? (
            <EmptyState icon={KeyRound} title="No agents connected yet" text="Create a key above to let an AI agent shop for you inside your rules." />
          ) : (
            <ul className="divide-y divide-line">
              {agents.map((a) => (
                <AgentCard key={`${a.id}-${a.monthlyBudget}`} a={a} limits={limits} onChanged={load} />
              ))}
            </ul>
          )}
        </section>
        <p className="flex items-center gap-1.5 text-[12.5px] text-subtle">
          <ListOrdered size={13} /> Everything a connected agent does shows up in your chats, in Insights, and in your decision trail.
        </p>
      </div>
    </div>
  );
}
