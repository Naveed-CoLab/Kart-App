"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, Clock, MoreHorizontal, Pencil, Pin, PinOff, Search, ShieldX, Trash2, X } from "lucide-react";
import { api, useApp } from "./app-context";
import { ClaudeMark } from "./logos";
import { useToast } from "./ui";

export type ChatSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  agent: string | null;
  pinned: boolean;
  status: "waiting" | "bought" | "blocked" | null;
};

/** Loads the shopper's chats and keeps them fresh when chats change or the page changes. */
export function useChats() {
  const path = usePathname();
  const { chatsVersion } = useApp();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api<{ chats: ChatSummary[] }>("/api/chats")
      .then((r) => setChats(r.chats))
      .catch(() => setChats([]));
  }, [chatsVersion, path, tick]);
  // Agents (Claude Desktop, ChatGPT…) can start chats from outside the app, so check again now and then.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);
  return { chats, reload: () => setTick((n) => n + 1) };
}

function group(c: ChatSummary) {
  if (c.status === "waiting") return "Needs your OK";
  if (c.pinned) return "Pinned";
  const d = new Date(c.updatedAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000;
  if (diff <= 0) return "Today";
  if (diff <= 1) return "Yesterday";
  if (diff <= 7) return "Previous 7 days";
  if (diff <= 30) return "Previous 30 days";
  return "Older";
}
const ORDER = ["Needs your OK", "Pinned", "Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];

export function AgentBadge({ agent, size = 12 }: { agent: string; size?: number }) {
  return (
    <span title={`Started by ${agent}`} className="inline-flex shrink-0 items-center">
      {/claude/i.test(agent) ? <ClaudeMark size={size} /> : <Bot size={size} className="text-violet" />}
    </span>
  );
}

function StatusMark({ status }: { status: ChatSummary["status"] }) {
  if (status === "waiting")
    return (
      <span title="Waiting for your OK" className="relative grid h-4 w-4 shrink-0 place-items-center">
        <span className="absolute h-2 w-2 animate-ping rounded-full bg-[#eda100]/60" />
        <span className="h-2 w-2 rounded-full bg-[#eda100]" />
      </span>
    );
  if (status === "bought") return <Check size={13} strokeWidth={2.6} className="shrink-0 text-success" aria-label="Bought" />;
  if (status === "blocked") return <ShieldX size={13} className="shrink-0 text-danger" aria-label="Blocked by your rules" />;
  return null;
}

function Row({ c, active, onNavigate, onChanged }: { c: ChatSummary; active: boolean; onNavigate?: () => void; onChanged: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { bumpChats } = useApp();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [title, setTitle] = useState(c.title);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setMenu(false);
        setConfirm(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const patch = async (body: object) => {
    await api(`/api/chats/${c.id}`, body, "PATCH");
    onChanged();
    bumpChats();
  };
  const rename = async () => {
    setEditing(false);
    const t = title.trim();
    if (t && t !== c.title) await patch({ title: t });
    else setTitle(c.title);
  };
  const remove = async () => {
    await api(`/api/chats/${c.id}`, {}, "DELETE");
    toast({ tone: "success", title: "Chat deleted", text: "Orders from it are still in My orders." });
    setMenu(false);
    onChanged();
    bumpChats();
    if (active) router.push("/shop");
  };

  if (editing)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          rename();
        }}
        className="px-1"
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setTitle(c.title);
              setEditing(false);
            }
          }}
          aria-label="Chat name"
          className="h-8 w-full rounded-lg border border-action/50 bg-surface px-2 text-[13px] outline-none shadow-[0_0_0_3px_rgba(0,112,224,0.1)]"
        />
      </form>
    );

  return (
    <div ref={ref} className="group relative">
      <Link
        href={`/chat/${c.id}`}
        onClick={onNavigate}
        className={`flex h-8 items-center gap-2 rounded-lg pl-2.5 pr-8 text-[13px] transition ${active ? "bg-[#e8edf5] font-medium text-ink" : "text-muted hover:bg-sunken hover:text-ink"}`}
      >
        {c.agent && <AgentBadge agent={c.agent} />}
        <span className="min-w-0 flex-1 truncate">{c.title}</span>
        <span className="group-hover:hidden">
          <StatusMark status={c.status} />
        </span>
      </Link>
      <button
        aria-label="Chat options"
        onClick={() => setMenu((v) => !v)}
        className={`absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md text-subtle hover:bg-surface hover:text-ink ${menu ? "flex bg-surface" : "hidden group-hover:grid"}`}
      >
        <MoreHorizontal size={15} />
      </button>
      {menu && (
        <div className="anim-in absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 text-[13px] shadow-[var(--shadow-pop)]">
          {confirm ? (
            <div className="p-2">
              <p className="text-[12.5px] text-muted">Delete this chat? Orders stay in My orders.</p>
              <div className="mt-2 flex gap-1.5">
                <button onClick={remove} className="h-7 flex-1 rounded-md bg-danger text-[12.5px] font-medium text-white hover:opacity-90">
                  Delete
                </button>
                <button onClick={() => setConfirm(false)} className="h-7 flex-1 rounded-md border border-line text-[12.5px] hover:bg-sunken">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem
                icon={Pencil}
                label="Rename"
                onClick={() => {
                  setMenu(false);
                  setEditing(true);
                }}
              />
              <MenuItem
                icon={c.pinned ? PinOff : Pin}
                label={c.pinned ? "Unpin" : "Pin to top"}
                onClick={() => {
                  setMenu(false);
                  patch({ pinned: !c.pinned });
                }}
              />
              <MenuItem icon={Trash2} label="Delete" danger onClick={() => setConfirm(true)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pin; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left hover:bg-sunken ${danger ? "text-danger" : "text-ink"}`}>
      <Icon size={14} className={danger ? "" : "text-muted"} /> {label}
    </button>
  );
}

/** Search box + grouped chat list + "waiting for you" banner. */
export function ChatList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { chats, reload } = useChats();
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = () => searchRef.current?.focus();
    window.addEventListener("kart:search", focus);
    return () => window.removeEventListener("kart:search", focus);
  }, []);

  const filtered = useMemo(() => (chats || []).filter((c) => !q.trim() || `${c.title} ${c.agent || ""}`.toLowerCase().includes(q.trim().toLowerCase())), [chats, q]);
  const groups = useMemo(() => {
    const m = new Map<string, ChatSummary[]>();
    for (const c of filtered) {
      const g = group(c);
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    return ORDER.filter((g) => m.has(g)).map((g) => [g, m.get(g)!] as const);
  }, [filtered]);

  return (
    <>
      <div className="mt-3 px-3">
        <label className="flex h-8 items-center gap-2 rounded-lg border border-transparent bg-sunken px-2.5 text-[13px] text-muted transition focus-within:border-action/40 focus-within:bg-surface">
          <Search size={14} className="shrink-0 text-subtle" />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle" />
          {q ? (
            <button aria-label="Clear search" onClick={() => setQ("")} className="text-subtle hover:text-ink">
              <X size={13} />
            </button>
          ) : (
            <kbd className="hidden rounded border border-line bg-surface px-1 text-[10.5px] font-medium text-subtle lg:inline">Ctrl K</kbd>
          )}
        </label>
      </div>

      <div className="scrollbar-thin mt-2 flex-1 overflow-y-auto px-3 pb-3">
        {!chats ? (
          <div className="space-y-1.5 pt-2">
            {[70, 55, 80, 45].map((w) => (
              <div key={w} className="shimmer h-6 rounded-md" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : !filtered.length ? (
          <p className="px-2.5 py-3 text-[12.5px] text-subtle">{q ? `No chats match "${q}".` : "Your chats will show up here."}</p>
        ) : (
          groups.map(([g, list]) => (
            <div key={g} className="mt-3 first:mt-1">
              <div className={`flex items-center gap-1.5 px-2.5 pb-1 text-[11.5px] font-medium ${g === "Needs your OK" ? "text-warn" : "text-subtle"}`}>
                {g === "Pinned" && <Pin size={11} />}
                {g === "Needs your OK" && <Clock size={11} />}
                {g}
                {g === "Needs your OK" && <span className="ml-auto rounded-full bg-[#eda100] px-1.5 text-[10.5px] font-semibold leading-4 text-white">{list.length}</span>}
              </div>
              <div className="space-y-px">
                {list.map((c) => (
                  <Row key={c.id} c={c} active={path === `/chat/${c.id}`} onNavigate={onNavigate} onChanged={reload} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/** Small count of chats waiting for the shopper, for the collapsed sidebar. */
export function WaitingCount() {
  const { chats } = useChats();
  const n = (chats || []).filter((c) => c.status === "waiting").length;
  const first = (chats || []).find((c) => c.status === "waiting");
  if (!n || !first) return null;
  return (
    <Link href={`/chat/${first.id}`} title={`${n} purchase${n > 1 ? "s" : ""} need your OK`} className="relative grid h-9 w-9 place-items-center rounded-lg text-warn hover:bg-warn-tint">
      <Clock size={17} />
      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#eda100] px-1 text-[10px] font-semibold text-white">{n}</span>
    </Link>
  );
}
