"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@lemonsqueezy/wedges";
import { Check, Copy, ExternalLink, Globe, Loader2 } from "lucide-react";
import type { StoreAccount } from "@/lib/types";
import { PayPalLogo, PayPalMark, StoreLogo } from "@/components/logos";
import { Badge, PageHeader, useToast } from "@/components/ui";

type Data = { stores: StoreAccount[]; current: { domain: string; demo: boolean } | null; owner?: string };

async function call<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "Something went wrong");
  return j as T;
}

function CopyField({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-[12.5px]">
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => {
          navigator.clipboard.writeText(value).catch(() => {});
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
      >
        {done ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function StoreCard({ s, onChange }: { s: StoreAccount; onChange: () => Promise<void> }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [email, setEmail] = useState(s.paypalEmail || "");
  const [err, setErr] = useState("");
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const verify = (method: "dns" | "file") =>
    run(method, async () => {
      await call("/api/stores/verify", { domain: s.domain, method });
      toast({ tone: "success", title: `${s.domain} verified` });
      await onChange();
    });
  const connectPayPal = () =>
    run("pp", async () => {
      const r = await call<{ url: string }>("/api/stores/paypal/connect", { domain: s.domain });
      window.location.href = r.url;
    });
  const saveEmail = () =>
    run("email", async () => {
      await call("/api/stores/paypal", { domain: s.domain, paypalEmail: email });
      toast({ tone: "success", title: "PayPal saved", text: `Orders from ${s.domain} are now paid to ${email}.` });
      await onChange();
    });
  const open = () =>
    run("open", async () => {
      await call("/api/session", { role: "store", store: s.domain });
      router.push("/store");
      router.refresh();
    });
  const paypalReady = !!(s.merchantId || s.paypalEmail);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <StoreLogo domain={s.domain} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{s.domain}</p>
          <p className="text-[12.5px] text-muted">Claimed by {s.ownerName}</p>
        </div>
        {s.verified && paypalReady ? (
          <Button onClick={open} disabled={!!busy}>
            {busy === "open" ? "Opening…" : "Open dashboard"}
          </Button>
        ) : (
          <Badge tone="amber">Setup not finished</Badge>
        )}
      </div>

      <ol className="divide-y divide-line">
        {/* step 1: verify */}
        <li className="px-5 py-5">
          <div className="flex items-center gap-2.5">
            <Step n={1} done={s.verified} />
            <p className="text-[14.5px] font-semibold">Prove you own {s.domain}</p>
            {s.verified && <span className="text-[12.5px] text-success">Verified by {s.verifiedBy === "dns" ? "DNS record" : "file on your site"}</span>}
          </div>
          {!s.verified && (
            <div className="mt-4 grid gap-4 pl-8 md:grid-cols-2">
              <div>
                <p className="flex items-center gap-1.5 text-[13px] font-medium">
                  <Globe size={14} className="text-muted" /> Add a DNS TXT record
                </p>
                <p className="mt-1 text-[12.5px] text-muted">In your domain settings, add a TXT record on {s.domain} with this value:</p>
                <div className="mt-2">
                  <CopyField value={`kart-verification=${s.verifyToken}`} />
                </div>
                <Button variant="outline" size="sm" className="mt-2.5" disabled={!!busy} onClick={() => verify("dns")}>
                  {busy === "dns" ? "Checking…" : "Check DNS record"}
                </Button>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[13px] font-medium">
                  <ExternalLink size={14} className="text-muted" /> Or upload a file
                </p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Put this code in <span className="font-mono">https://{s.domain}/.well-known/kart-verification.txt</span>
                </p>
                <div className="mt-2">
                  <CopyField value={s.verifyToken} />
                </div>
                <Button variant="outline" size="sm" className="mt-2.5" disabled={!!busy} onClick={() => verify("file")}>
                  {busy === "file" ? "Checking…" : "Check file"}
                </Button>
              </div>
            </div>
          )}
        </li>

        {/* step 2: PayPal */}
        <li className={`px-5 py-5 ${s.verified ? "" : "opacity-55"}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <Step n={2} done={paypalReady} />
            <p className="text-[14.5px] font-semibold">Connect PayPal to get paid</p>
            {s.merchantId ? (
              <span className="text-[12.5px] text-success">Connected with PayPal</span>
            ) : s.paypalEmail ? (
              <span className="text-[12.5px] text-success">Payments go to {s.paypalEmail}</span>
            ) : null}
          </div>
          {s.verified && (
            <div className="mt-4 grid gap-4 pl-8 md:grid-cols-2">
              <div>
                <p className="text-[13px] font-medium">Recommended</p>
                <p className="mt-1 text-[12.5px] text-muted">Log into your PayPal business account and give Kart permission to send you orders.</p>
                <button
                  type="button"
                  onClick={connectPayPal}
                  disabled={!!busy}
                  className="mt-2.5 inline-flex h-10 items-center gap-2 rounded-full bg-[#FFC439] px-5 text-[14px] font-semibold text-[#111] transition hover:bg-[#F2BA36] disabled:opacity-60"
                >
                  {busy === "pp" ? <Loader2 size={15} className="animate-spin" /> : <PayPalMark size={15} />}
                  Connect with <PayPalLogo height={15} />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEmail();
                }}
              >
                <p className="text-[13px] font-medium">Or use your PayPal business email</p>
                <p className="mt-1 text-[12.5px] text-muted">In sandbox, use your PayPal sandbox Business account email.</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="payments@yourstore.com"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line px-3 text-[13.5px] outline-none focus:border-action"
                  />
                  <Button type="submit" variant="outline" size="sm" className="h-9" disabled={!!busy || !email.trim()}>
                    {busy === "email" ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </li>
      </ol>
      {err && <p className="border-t border-line bg-danger-tint/50 px-5 py-3 text-[13px] text-danger">{err}</p>}
    </section>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${done ? "bg-success text-white" : "bg-sunken text-muted"}`}>
      {done ? <Check size={13} strokeWidth={3} /> : n}
    </span>
  );
}

function ConnectInner() {
  const q = useSearchParams();
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/stores", { cache: "no-store" }).then((x) => x.json());
    setD(r);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (q.get("paypal") === "connected") toast({ tone: "success", title: "PayPal connected", text: `${q.get("domain")} is paid straight into your PayPal account.` });
    if (q.get("paypal") === "failed") toast({ tone: "error", title: "PayPal didn't finish connecting", text: "Try again, or add your PayPal business email instead." });
  }, [q, toast]);

  const claim = async () => {
    setBusy(true);
    setErr("");
    try {
      await call("/api/stores", { domain });
      setDomain("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[880px] space-y-5 px-6 py-7">
        <PageHeader title="Your stores" description="Join Kart in two steps: prove you own your domain, then connect PayPal. Orders from Kart shoppers are then paid straight into your PayPal." />

        {d?.current?.demo && (
          <div className="rounded-xl border border-violet/20 bg-violet-tint px-4 py-3 text-[13px] text-violet">You&apos;re in the demo store. Sign in as a store owner to add your own store.</div>
        )}

        {d?.stores.map((s) => <StoreCard key={s.domain} s={s} onChange={load} />)}

        {!d?.current?.demo && (
          <section className="card p-5">
            <h2 className="text-[15px] font-semibold">{d?.stores.length ? "Add another store" : "Add your store"}</h2>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                claim();
              }}
            >
              <div className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-line px-3 focus-within:border-action">
                {domain ? <StoreLogo domain={domain} size={18} /> : <Globe size={16} className="text-subtle" />}
                <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourstore.com" className="h-full flex-1 bg-transparent text-[14px] outline-none" aria-label="Store domain" />
              </div>
              <Button type="submit" disabled={busy || !domain.trim()}>
                {busy ? "Adding…" : "Add store"}
              </Button>
            </form>
            {err && <p className="mt-2 text-[13px] text-danger">{err}</p>}
            <p className="mt-3 text-[12.5px] text-subtle">Until a store joins, Kart pays its orders through Kart&apos;s own sandbox store account.</p>
          </section>
        )}
      </div>
    </div>
  );
}

export default function StoreConnect() {
  return (
    <Suspense>
      <ConnectInner />
    </Suspense>
  );
}
