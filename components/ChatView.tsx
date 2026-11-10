"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Brain, Check, ChevronDown, CircleDollarSign, Copy, Loader2, ShieldX, Sparkles, ThumbsUp } from "lucide-react";
import { AgentBadge } from "./ChatList";
import { useToast } from "./ui";
import type { Product, UIItem } from "@/lib/types";
import { api, useApp } from "./app-context";
import Composer from "./Composer";
import { KartOrb, IconGuarantee } from "./icons";
import { ApprovalCard, BlockedCard, ClaimCard, NoticeCard, OrderCard, ProductCards, WatchCard } from "./ChatCards";
import { Skeleton } from "./ui";

type StepItem = Extract<UIItem, { kind: "step" }>;
type Row = { kind: "steps"; id: string; steps: StepItem[] } | { kind: "item"; item: Exclude<UIItem, StepItem> };

function UserBubble({ item }: { item: Extract<UIItem, { kind: "user" }> }) {
  return (
    <div className="anim-in flex justify-end">
      <div className="flex max-w-[78%] flex-col items-end gap-2">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="Your photo" className="max-h-56 rounded-2xl border border-line object-cover shadow-[var(--shadow-card)]" />
        )}
        {item.text && item.text !== "(photo)" && <div className="rounded-[20px] rounded-br-md bg-[#e9eef6] px-4 py-2.5 text-[15px] leading-relaxed text-ink">{item.text}</div>}
      </div>
    </div>
  );
}

/** Inline **bold** and `code`. */
function inline(t: string, key: string) {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <b key={key + i} className="font-semibold">
        {part.slice(2, -2)}
      </b>
    ) : part.startsWith("`") && part.endsWith("`") ? (
      <code key={key + i} className="rounded bg-sunken px-1 py-0.5 font-mono text-[13px]">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

/** Small Markdown subset Claude uses in replies: paragraphs, bullet and numbered lists, bold. */
function Rich({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list;
    blocks.push(
      L.ordered ? (
        <ol key={blocks.length} className="ml-5 list-decimal space-y-1 marker:text-subtle">
          {L.items.map((t, i) => (
            <li key={i} className="pl-1">{inline(t, `o${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={blocks.length} className="ml-5 list-disc space-y-1 marker:text-subtle">
          {L.items.map((t, i) => (
            <li key={i} className="pl-1">{inline(t, `u${i}`)}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const b = line.match(/^\s*[-*•]\s+(.*)$/);
    const n = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (b || n) {
      const ordered = !!n;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((b || n)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      h ? (
        <p key={blocks.length} className="font-semibold">
          {inline(h[1], `h${blocks.length}`)}
        </p>
      ) : (
        <p key={blocks.length}>{inline(line, `p${blocks.length}`)}</p>
      ),
    );
  }
  flush();
  return <div className="space-y-2.5 text-[15px] leading-[1.65] text-ink">{blocks}</div>;
}

function AssistantText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const toast = useToast();
  return (
    <div className="group">
      <Rich text={text} />
      <div className="mt-1.5 flex gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button
          aria-label="Copy"
          title="Copy"
          className="grid h-7 w-7 place-items-center rounded-md text-subtle hover:bg-sunken hover:text-ink"
          onClick={() => {
            navigator.clipboard.writeText(text).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <button
          aria-label="Good response"
          title="Good response"
          onClick={() => {
            if (!liked) toast({ tone: "success", title: "Thanks for the feedback" });
            setLiked((v) => !v);
          }}
          className={`grid h-7 w-7 place-items-center rounded-md hover:bg-sunken ${liked ? "text-action" : "text-subtle hover:text-ink"}`}
        >
          <ThumbsUp size={14} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}

/** Follow-up ideas based on what's on screen, like ChatGPT's suggested replies. */
function followUps(items: UIItem[]): string[] {
  const last = [...items].reverse().find((i) => i.kind !== "step" && i.kind !== "assistant");
  if (!last) return [];
  if (last.kind === "approval" && last.state === "pending") return [];
  if (last.kind === "products") return ["Buy the Kart pick", "Show me cheaper options", "Compare the top two"];
  if (last.kind === "order") return ["Where is my order?", "It arrived damaged", "Find me something else"];
  if (last.kind === "blocked") return ["Find something within my limits", "Why was it blocked?"];
  if (last.kind === "claim") return ["Show my orders", "Find a replacement"];
  if (last.kind === "watch") return ["What else are you watching?", "Buy it now instead"];
  return [];
}

/** Icon for one step of the trace. */
function StepIcon({ s, active }: { s: StepItem; active: boolean }) {
  if (active) return <Loader2 size={13} className="animate-spin text-action" />;
  if (s.thought) return <Brain size={13} className="text-violet" />;
  if (s.tone === "stop") return <ShieldX size={13} className="text-danger" />;
  if (s.tone === "money") return <CircleDollarSign size={13} className="text-success" />;
  return <Check size={13} strokeWidth={2.6} className="text-success" />;
}

/**
 * Claude-style "thinking" panel: while Kart works it stays open and each real step appears in turn
 * (Claude's reasoning, rules checked, live price, PayPal charged, store paid…). When done it folds
 * into "Thought for 4s · 6 steps", and opens again on click.
 */
function Trace({ steps, running, seconds }: { steps: StepItem[]; running: boolean; seconds: number }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? running;
  const last = steps[steps.length - 1];
  const actions = steps.filter((s) => !s.thought).length;
  const stopped = steps.some((s) => s.tone === "stop");
  return (
    <div className="anim-in">
      <button onClick={() => setOpen(!expanded)} className="group flex items-center gap-2 py-1 text-[13px] text-muted hover:text-ink" aria-expanded={expanded}>
        {running ? <Loader2 size={14} className="animate-spin text-action" /> : stopped ? <ShieldX size={14} className="text-danger" /> : <Sparkles size={14} className="text-action" />}
        <span className={running ? "thinking-shimmer font-medium" : "font-medium"}>
          {running ? (last.thought ? "Thinking…" : `${last.label}…`) : `${stopped ? "Stopped safely" : "Thought"} for ${Math.max(1, seconds)}s · ${actions} step${actions === 1 ? "" : "s"}`}
        </span>
        <ChevronDown size={14} className={`transition ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <ol className="ml-[7px] mt-1 space-y-2.5 border-l-2 border-line py-1 pl-4">
          {steps.map((s, i) => (
            <li key={s.id} className="trace-step relative">
              <span className="absolute -left-[25px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-surface">
                <StepIcon s={s} active={running && i === steps.length - 1} />
              </span>
              {s.thought ? (
                <p className="whitespace-pre-wrap text-[12.5px] italic leading-relaxed text-muted">{s.detail}</p>
              ) : (
                <>
                  <p className={`text-[13px] font-medium ${s.tone === "stop" ? "text-danger" : "text-ink"}`}>{s.label}</p>
                  {s.detail && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{s.detail}</p>}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function ChatView({ chatId }: { chatId: string }) {
  const { refreshRules, bumpChats } = useApp();
  const [items, setItems] = useState<UIItem[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [meta, setMeta] = useState<{ agent: string | null }>({ agent: null });
  // How many items are on screen. New items appear one at a time (steps ~0.6s apart), so the trace
  // plays out like a "thinking" panel instead of popping in all at once. History loads instantly.
  const [shown, setShown] = useState(0);
  const firstLoad = useRef(true);
  const traceTimes = useRef(new Map<string, { start: number; end: number }>());

  const reload = useCallback(async () => {
    const r = await api<{ ui: UIItem[]; title: string; agent: string | null }>(`/api/chats/${chatId}`);
    setItems(r.ui);
    if (firstLoad.current) {
      firstLoad.current = false;
      setShown(r.ui.length);
    }
    setTitle(r.title);
    setMeta({ agent: r.agent });
    setLoaded(true);
    refreshRules();
  }, [chatId, refreshRules]);

  const send = useCallback(
    async (text: string, image: string | null) => {
      setBusy(true);
      setError("");
      setItems((xs) => [...xs, { id: "local-" + Date.now(), kind: "user", text, image }]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      setAtBottom(true);
      try {
        const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, text, image }), signal: ctrl.signal });
        if (!res.body) throw new Error("No response");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const msg = JSON.parse(line);
            if (msg.item) setItems((xs) => [...xs, msg.item]);
            if (msg.error) setError(msg.error);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        abort.current = null;
        setBusy(false);
        bumpChats();
        await reload();
      }
    },
    [chatId, reload, bumpChats],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    reload().then(() => {
      const key = `kart-pending-${chatId}`;
      const pending = sessionStorage.getItem(key);
      if (pending) {
        sessionStorage.removeItem(key);
        const { text, image } = JSON.parse(pending);
        send(text, image);
      }
    });
  }, [chatId, reload, send]);

  // Follow new messages only when the shopper is already at the bottom (like ChatGPT).
  useEffect(() => {
    if (atBottom) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, busy]);
  const onScroll = () => {
    const el = scroller.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };
  const stop = () => abort.current?.abort();
  const suggestions = busy || shown < items.length ? [] : followUps(items);

  useEffect(() => {
    if (shown >= items.length) return;
    const next = items[shown];
    const wait = next.kind === "step" ? (next.thought ? 900 : 620) : items[shown - 1]?.kind === "step" ? 450 : 120;
    const t = setTimeout(() => setShown((n) => Math.min(items.length, n + 1)), wait);
    return () => clearTimeout(t);
  }, [shown, items]);
  const revealing = shown < items.length;

  // Group consecutive tool steps into one collapsible trace.
  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const it of items.slice(0, shown)) {
      if (it.kind === "step") {
        const last = out[out.length - 1];
        if (last?.kind === "steps") last.steps.push(it);
        else out.push({ kind: "steps", id: it.id, steps: [it] });
      } else out.push({ kind: "item", item: it });
    }
    // Timing per trace, measured as it plays, for "Thought for 4s". Only the trace at the bottom can
    // still be growing; earlier ones keep the time they finished with.
    const now = Date.now();
    out.forEach((r, i) => {
      if (r.kind !== "steps") return;
      const t = traceTimes.current.get(r.id);
      if (!t) traceTimes.current.set(r.id, { start: now, end: now });
      else if (i === out.length - 1) t.end = now;
    });
    return out;
  }, [items, shown]);

  const buy = (p: Product) => send(`Buy the ${p.title}`, null);

  const renderItem = (it: Exclude<UIItem, StepItem>) => {
    switch (it.kind) {
      case "user":
        return <UserBubble item={it} />;
      case "assistant":
        return <AssistantText text={it.text} />;
      case "products":
        return <ProductCards item={it} onBuy={buy} disabled={busy} />;
      case "approval":
        return <ApprovalCard item={it} chatId={chatId} onChanged={reload} />;
      case "blocked":
        return <BlockedCard item={it} />;
      case "order":
        return <OrderCard order={it.order} auto={it.auto} onChanged={reload} />;
      case "claim":
        return <ClaimCard claim={it.claim} order={it.order} />;
      case "notice":
        return <NoticeCard item={it} />;
      case "watch":
        return <WatchCard watch={it.watch} chatId={chatId} onChanged={reload} />;
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[13.5px] font-medium">{title && title !== "New chat" ? title : "New chat"}</h1>
          {meta.agent && (
            <span className="badge shrink-0 bg-violet-tint text-violet">
              <AgentBadge agent={meta.agent} /> via {meta.agent}
            </span>
          )}
        </div>
        <span className="badge hidden shrink-0 bg-success-tint text-success sm:inline-flex">
          <IconGuarantee size={14} /> Kart Guarantee on every order
        </span>
      </header>
      <div ref={scroller} onScroll={onScroll} className="scrollbar-thin relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] space-y-5 px-5 py-8">
          {!loaded && (
            <div className="space-y-3">
              <Skeleton className="ml-auto h-10 w-64" />
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-4 w-56" />
            </div>
          )}
          {rows.map((r, idx) => {
            if (r.kind === "steps")
              return (
                <div key={r.id} className="pl-10">
                  <Trace
                    steps={r.steps}
                    running={idx === rows.length - 1 && (busy || revealing)}
                    seconds={(() => {
                      // Measured while it played; for history, from the steps' own timestamps.
                      const t = traceTimes.current.get(r.id);
                      const played = t ? Math.round((t.end - t.start) / 1000) : 0;
                      const at = r.steps.map((x) => (x.at ? Date.parse(x.at) : NaN)).filter((n) => !Number.isNaN(n));
                      const logged = at.length > 1 ? Math.round((Math.max(...at) - Math.min(...at)) / 1000) : 0;
                      return Math.max(played, logged) + 1;
                    })()}
                  />
                </div>
              );
            const it = r.item;
            if (it.kind === "user") return <div key={it.id}>{renderItem(it)}</div>;
            const showAvatar = it.kind === "assistant" && (idx === 0 || rows[idx - 1].kind !== "item" || (rows[idx - 1] as any).item?.kind === "user");
            return (
              <div key={it.id} className="flex gap-3">
                <div className="w-7 shrink-0 pt-0.5">{showAvatar && <KartOrb size={26} />}</div>
                <div className="min-w-0 flex-1">{renderItem(it)}</div>
              </div>
            );
          })}
          {(busy || revealing) && rows[rows.length - 1]?.kind !== "steps" && (
            <div className="flex gap-3">
              <div className="w-7 shrink-0">
                <KartOrb size={26} thinking />
              </div>
              <div className="dot-pulse flex items-center gap-1 pt-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted" />
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start justify-between gap-3 rounded-xl bg-danger-tint px-4 py-3 text-[13px] text-danger">
              <span>Something went wrong: {error}</span>
              <button onClick={() => setError("")} className="shrink-0 font-medium underline-offset-2 hover:underline">
                Dismiss
              </button>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="anim-in flex flex-wrap gap-2 pl-10">
              {suggestions.map((t) => (
                <button
                  key={t}
                  onClick={() => send(t, null)}
                  className="h-8 rounded-full border border-line bg-surface px-3 text-[12.5px] text-muted shadow-[var(--shadow-xs)] transition hover:border-action/40 hover:text-ink"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <div ref={bottom} className="h-4" />
        </div>
      </div>
      <div className="relative shrink-0 px-5 pb-4">
        {!atBottom && (
          <button
            aria-label="Jump to latest"
            onClick={() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
            className="anim-in absolute -top-12 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-line bg-surface text-muted shadow-[var(--shadow-pop)] hover:text-ink"
          >
            <ArrowDown size={16} />
          </button>
        )}
        <div className="mx-auto max-w-[760px]">
          <Composer onSend={send} disabled={busy} onStop={busy ? stop : undefined} placeholder="Reply to Kart, or attach a photo of a problem…" />
          <p className="mt-2 text-center text-[11.5px] text-subtle">Kart only spends within your rules. Payments run on PayPal Sandbox.</p>
        </div>
      </div>
    </div>
  );
}
