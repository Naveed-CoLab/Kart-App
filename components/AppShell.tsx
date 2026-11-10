"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot, Store, LayoutGrid, MessageSquarePlus, Menu, Settings2, X, PanelLeft, LogOut, ArrowLeftRight, BookOpen, Search, ChevronsUpDown, BarChart3 } from "lucide-react";
import { ChatList, WaitingCount } from "./ChatList";
import { SessionProvider, useSession } from "./session";
import { PayPalMark, StoreLogo } from "./logos";
import { AppProvider, useApp, usd, usd0 } from "./app-context";
import RulesDrawer from "./RulesDrawer";
import { PayPalProvider } from "./PayPalProvider";
import { ToastProvider } from "./ui";
import { IconGuarantee } from "./icons";
import { KartOrb } from "./icons";
import { UserAvatar } from "./logos";

export function Logo({ size = 28, text = true, tone = "blue" }: { size?: number; text?: boolean; tone?: "blue" | "ink" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <KartOrb size={size} tone={tone} />
      {text && (
        <span className={`text-[19px] font-[680] leading-none tracking-[-0.045em] ${tone === "light" ? "text-white" : "text-ink"}`} style={{ fontSize: Math.round(size * 0.68) }}>
          kart
        </span>
      )}
    </span>
  );
}

function NavItem({ href, icon: Icon, label, active, onClick }: { href: string; icon: any; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition ${active ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06),0_0_0_1px_rgba(16,24,40,0.05)]" : "text-muted hover:bg-sunken hover:text-ink"}`}
    >
      <Icon size={16} className={active ? "text-action" : "text-subtle group-hover:text-muted"} />
      {label}
    </Link>
  );
}

function RailButton({ href, onClick, icon: Icon, label, active }: { href?: string; onClick?: () => void; icon: any; label: string; active?: boolean }) {
  const cls = `grid h-9 w-9 place-items-center rounded-lg transition ${active ? "bg-surface text-action shadow-[0_1px_2px_rgba(16,24,40,0.06),0_0_0_1px_rgba(16,24,40,0.05)]" : "text-muted hover:bg-sunken hover:text-ink"}`;
  return href ? (
    <Link href={href} title={label} aria-label={label} className={cls}>
      <Icon size={17} />
    </Link>
  ) : (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={cls}>
      <Icon size={17} />
    </button>
  );
}

/** Collapsed sidebar: a slim rail of icons. */
function SidebarRail({ onExpand }: { onExpand: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const { rules, monthSpent, setRulesOpen } = useApp();
  const session = useSession();
  const who = session?.name && session.name !== "Demo shopper" ? session.name : rules?.payerName || session?.name || "Shopper";
  const capPct = rules ? Math.min(100, (monthSpent / rules.monthlyCap) * 100) : 0;
  return (
    <aside className="flex h-full w-[60px] flex-col items-center border-r border-line bg-sidebar py-3">
      <button onClick={onExpand} title="Open sidebar" aria-label="Open sidebar" className="group relative grid h-9 w-9 place-items-center rounded-lg hover:bg-sunken">
        <span className="group-hover:opacity-0">
          <KartOrb size={26} />
        </span>
        <PanelLeft size={17} className="absolute text-muted opacity-0 group-hover:opacity-100" />
      </button>
      <div className="mt-4 flex flex-col items-center gap-1">
        <RailButton onClick={() => router.push("/shop")} icon={MessageSquarePlus} label="New chat (Ctrl+Shift+O)" active={path === "/shop"} />
        <RailButton
          onClick={() => {
            onExpand();
            setTimeout(() => window.dispatchEvent(new Event("kart:search")), 50);
          }}
          icon={Search}
          label="Search chats (Ctrl+K)"
        />
        <RailButton href="/orders" icon={LayoutGrid} label="My orders & spending" active={path.startsWith("/orders")} />
        <RailButton href="/insights" icon={BarChart3} label="Insights" active={path.startsWith("/insights")} />
        <RailButton href="/agents" icon={Bot} label="Connected agents" active={path.startsWith("/agents")} />
        <WaitingCount />
      </div>
      <div className="flex-1" />
      <button onClick={() => setRulesOpen(true)} title={rules ? `Spending rules: ${usd(monthSpent)} of ${usd0(rules.monthlyCap)} used this month` : "Spending rules"} className="mb-3 grid h-9 w-9 place-items-center rounded-lg hover:bg-sunken">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
          <circle cx="13" cy="13" r="10.5" fill="none" stroke="var(--color-sunken)" strokeWidth="3" />
          <circle cx="13" cy="13" r="10.5" fill="none" stroke={capPct > 85 ? "var(--color-danger)" : "var(--color-action)"} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(capPct / 100) * 66} 66`} transform="rotate(-90 13 13)" />
        </svg>
      </button>
      <UserAvatar name={who} />
    </aside>
  );
}

function Sidebar({ onNavigate, onCollapse }: { onNavigate?: () => void; onCollapse?: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const { rules, monthSpent, setRulesOpen, status } = useApp();
  const capPct = rules ? Math.min(100, (monthSpent / rules.monthlyCap) * 100) : 0;
  const session = useSession();
  const who = session?.name && session.name !== "Demo shopper" ? session.name : rules?.payerName || session?.name || "Shopper";
  return (
    <aside className="flex h-full w-[268px] flex-col border-r border-line bg-sidebar">
      <div className="flex h-14 items-center justify-between pl-4 pr-2">
        <Link href="/shop" onClick={onNavigate} className="flex items-center gap-2">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          {status && <span className={`badge ${status.paypal ? (status.sandbox ? "bg-warn-tint text-warn" : "bg-success-tint text-success") : "bg-sunken text-muted"}`}>{status.paypal ? (status.sandbox ? "Sandbox" : "Live") : "Setup needed"}</span>}
          {onCollapse && (
            <button onClick={onCollapse} title="Close sidebar" aria-label="Close sidebar" className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-sunken hover:text-ink">
              <PanelLeft size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="px-3">
        <button
          onClick={() => {
            router.push("/shop");
            onNavigate?.();
          }}
          className="group flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13.5px] font-medium text-ink shadow-[var(--shadow-xs)] transition hover:border-line-strong"
        >
          <MessageSquarePlus size={15} className="text-action" />
          <span className="flex-1 text-left">New chat</span>
          <kbd className="hidden rounded border border-line px-1 text-[10.5px] font-medium text-subtle group-hover:inline">Ctrl ⇧ O</kbd>
        </button>
      </div>
      <nav className="mt-2 space-y-0.5 px-3">
        <NavItem href="/orders" icon={LayoutGrid} label="My orders & spending" active={path.startsWith("/orders")} onClick={onNavigate} />
        <NavItem href="/insights" icon={BarChart3} label="Insights" active={path.startsWith("/insights")} onClick={onNavigate} />
        <NavItem href="/agents" icon={Bot} label="Connected agents" active={path.startsWith("/agents")} onClick={onNavigate} />
      </nav>

      <ChatList onNavigate={onNavigate} />

      <div className="border-t border-line p-2.5">
        <button onClick={() => setRulesOpen(true)} className="w-full rounded-xl px-2.5 py-2 text-left transition hover:bg-sunken">
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <IconGuarantee size={14} className="text-success" /> Spending rules
            </span>
            {rules ? (
              <span className="tabular-nums text-muted">
                <b className="font-semibold text-ink">{usd(monthSpent)}</b> / {usd0(rules.monthlyCap)}
              </span>
            ) : (
              <span className="shimmer h-3 w-16 rounded" />
            )}
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#e6eaf0]">
            <div className={`h-full rounded-full transition-all ${capPct > 85 ? "bg-danger" : "bg-action"}`} style={{ width: `${capPct}%` }} />
          </div>
          {rules && (
            <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-subtle">
              <span className="tabular-nums">
                Auto ≤ {usd0(rules.autoBuyUnder)} · Max {usd0(rules.perItemMax)}
              </span>
              <span className={rules.mandateActive ? "font-medium text-success" : ""}>{rules.mandateActive ? "One-tap on" : "Ask each time"}</span>
            </div>
          )}
        </button>
        <AccountMenu who={who} onNavigate={onNavigate} />
      </div>
    </aside>
  );
}

/** ChatGPT-style account button: one row, opens a menu upward. */
function AccountMenu({ who, onNavigate }: { who: string; onNavigate?: () => void }) {
  const { rules, setRulesOpen } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const paypal = rules?.mandateActive ? "PayPal saved for one-tap" : rules?.payerEmail ? "PayPal connected" : "PayPal connects at checkout";
  const item = "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-ink hover:bg-sunken";
  const go = () => {
    setOpen(false);
    onNavigate?.();
  };
  return (
    <div ref={ref} className="relative mt-1">
      {open && (
        <div className="anim-in absolute bottom-full left-0 right-0 z-30 mb-1.5 rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-pop)]">
          <div className="flex items-center gap-2.5 border-b border-line px-2.5 pb-2.5 pt-2">
            <UserAvatar name={who} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium">{who}</div>
              <div className="flex items-center gap-1 truncate text-[11.5px] text-subtle">
                <PayPalMark size={10} /> {paypal}
              </div>
            </div>
          </div>
          <div className="pt-1">
            <button
              className={item}
              onClick={() => {
                setOpen(false);
                setRulesOpen(true);
              }}
            >
              <Settings2 size={15} className="text-muted" /> Spending rules
            </button>
            <Link href="/orders" onClick={go} className={item}>
              <LayoutGrid size={15} className="text-muted" /> My orders & spending
            </Link>
            <Link href="/agents" onClick={go} className={item}>
              <Bot size={15} className="text-muted" /> Connected agents
            </Link>
            <Link href="/login?as=store" onClick={go} className={item}>
              <ArrowLeftRight size={15} className="text-muted" /> Switch to the store side
            </Link>
            <div className="my-1 h-px bg-line" />
            <Link href="/logout" onClick={go} className={`${item} text-danger`}>
              <LogOut size={15} /> Sign out
            </Link>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Account menu" className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-sunken ${open ? "bg-sunken" : ""}`}>
        <UserAvatar name={who} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-medium">{who}</div>
          <div className="flex items-center gap-1 truncate text-[11.5px] text-subtle">
            {paypal}
          </div>
        </div>
        <ChevronsUpDown size={14} className="shrink-0 text-subtle" />
      </button>
    </div>
  );
}

function SignOutButton() {
  return (
    <Link href="/logout" aria-label="Sign out" title="Sign out" className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-sunken hover:text-ink">
      <LogOut size={15} />
    </Link>
  );
}

/** The store side: its own sidebar, scoped to the signed-in store. */
function StoreSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const session = useSession();
  const demo = session?.store === "demo";
  const store = demo ? "Demo store" : session?.store || "";
  return (
    <aside className="flex h-full w-[256px] flex-col border-r border-line bg-sidebar">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/store" onClick={onNavigate} className="flex items-center gap-2">
          <Logo />
        </Link>
        <span className="badge bg-violet-tint text-violet">For stores</span>
      </div>
      <div className="px-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-xs)]">
          {demo ? (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-tint text-violet">
              <Store size={16} />
            </span>
          ) : store ? (
            <StoreLogo domain={store} size={32} />
          ) : (
            <span className="h-8 w-8 rounded-lg bg-sunken" />
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13.5px] font-semibold">{store || "No store open"}</div>
            <div className="truncate text-[11.5px] text-subtle">{demo ? "Your demo orders" : store ? "Verified store" : "Finish setup"}</div>
          </div>
        </div>
      </div>
      <nav className="mt-4 space-y-0.5 px-3">
        <NavItem href="/store" icon={LayoutGrid} label="Orders & payouts" active={path === "/store"} onClick={onNavigate} />
        <NavItem href="/store/connect" icon={Settings2} label="Store settings" active={path.startsWith("/store/connect")} onClick={onNavigate} />
        <NavItem href="/#stores" icon={BookOpen} label="How Kart works for stores" active={false} onClick={onNavigate} />
      </nav>
      <div className="flex-1" />
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 px-1">
          <UserAvatar name={store || "Store"} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium">{session?.name || "Store owner"}</div>
            <div className="truncate text-[11.5px] text-subtle">{demo ? "Demo store" : "Store owner"}</div>
          </div>
          <SignOutButton />
        </div>
        <Link href="/login?as=shopper" onClick={onNavigate} className="mt-2 flex h-8 items-center justify-center gap-1.5 rounded-lg text-[12px] text-muted hover:bg-sunken hover:text-ink">
          <ArrowLeftRight size={13} /> Switch to the shopper side
        </Link>
      </div>
    </aside>
  );
}

/** Tells the user exactly which keys are missing, instead of silently falling back to fake data. */
function SetupBanner() {
  const { status } = useApp();
  if (!status) return null;
  const missing = [
    !status.anthropic && "ANTHROPIC_API_KEY (Claude)",
    !status.channel3 && "CHANNEL3_API_KEY (product search)",
    !status.paypal && "PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET (payments)",
    status.paypal && !status.payouts && "STORE_PAYPAL_EMAIL (store payments)",
  ].filter(Boolean) as string[];
  if (!missing.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-warn/20 bg-warn-tint px-5 py-2 text-[12.5px] text-warn">
      <b className="font-semibold">Finish setup:</b>
      <span>add {missing.join(", ")} to .env.local, then restart Kart.</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("kart-sidebar") === "closed");
    } catch {}
  }, []);
  const setCollapse = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem("kart-sidebar", v ? "closed" : "open");
    } catch {}
  };
  const shopper = !path.startsWith("/store");
  // Pages can fold the sidebar for room (Insights' AI panel) and restore it after, without saving it.
  const before = useRef<boolean | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d === "collapse") {
        setCollapsed((v) => {
          if (before.current === null) before.current = v;
          return true;
        });
      } else if (d === "restore" && before.current !== null) {
        const v = before.current;
        before.current = null;
        setCollapsed(v);
      }
    };
    window.addEventListener("kart:sidebar", on);
    return () => window.removeEventListener("kart:sidebar", on);
  }, []);
  // ChatGPT-style shortcuts: Ctrl/Cmd+Shift+O new chat, Ctrl/Cmd+K search, Ctrl/Cmd+Shift+S toggle sidebar.
  useEffect(() => {
    if (!shopper) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (e.shiftKey && k === "o") {
        e.preventDefault();
        router.push("/shop");
      } else if (!e.shiftKey && k === "k") {
        e.preventDefault();
        setCollapse(false);
        if (window.innerWidth < 768) setOpen(true);
        setTimeout(() => window.dispatchEvent(new Event("kart:search")), 60);
      } else if (e.shiftKey && k === "s") {
        e.preventDefault();
        setCollapsed((v) => {
          try {
            localStorage.setItem("kart-sidebar", v ? "open" : "closed");
          } catch {}
          return !v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shopper, router]);
  if (path === "/" || path.startsWith("/login") || path.startsWith("/logout")) return <>{children}</>; // marketing + sign-in: no app chrome
  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden md:block">
        {!shopper ? <StoreSidebar /> : collapsed ? <SidebarRail onExpand={() => setCollapse(false)} /> : <Sidebar onCollapse={() => setCollapse(true)} />}
      </div>
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="anim-in h-full shadow-2xl">{shopper ? <Sidebar onNavigate={() => setOpen(false)} /> : <StoreSidebar onNavigate={() => setOpen(false)} />}</div>
          <button aria-label="Close menu" className="flex-1 bg-ink/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
        </div>
      )}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center justify-between border-b border-line bg-surface px-3 md:hidden">
          <button aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-sunken" onClick={() => setOpen(true)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Logo size={24} />
          {shopper ? (
            <Link href="/shop" aria-label="New chat" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-sunken">
              <MessageSquarePlus size={18} />
            </Link>
          ) : (
            <span className="w-9" />
          )}
        </div>
        <SetupBanner />
        {children}
      </main>
      {shopper && <RulesDrawer />}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
    <AppProvider>
      <ToastProvider>
        <PayPalProvider>
          <Shell>{children}</Shell>
        </PayPalProvider>
      </ToastProvider>
    </AppProvider>
    </SessionProvider>
  );
}
