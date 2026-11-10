"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@lemonsqueezy/wedges";
import { Check } from "lucide-react";
import { ClerkLoaded, ClerkLoading, SignIn, useUser } from "@clerk/nextjs";
import { Logo } from "@/components/AppShell";
import { signIn } from "@/components/session";
import { IconGuarantee, IconRules, IconStore, IconDiscover, IconPay, IconParcel } from "@/components/icons";
import { PayPalLogo } from "@/components/logos";

type Role = "shopper" | "store";
const clerkOn = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const SIDE: Record<Role, { title: string; body: string; points: [typeof IconRules, string][] }> = {
  shopper: {
    title: "Shop with an agent that can’t overspend.",
    body: "Tell Kart what you need. It finds it, pays with your PayPal inside your limits, and pays you back first if anything goes wrong.",
    points: [
      [IconDiscover, "Real products from thousands of stores, with reasons"],
      [IconRules, "Your limits: Kart asks before anything over your auto-buy amount"],
      [IconPay, "Your PayPal pays the store directly. Kart never holds your money"],
      [IconGuarantee, "Damaged, lost or cheaper later? Money back in seconds"],
    ],
  },
  store: {
    title: "Paid orders from AI shoppers.",
    body: "See every order Kart sends you, add tracking, and settle returns. You only see your own store.",
    points: [
      [IconPay, "Orders arrive already paid into your PayPal"],
      [IconParcel, "Add tracking once; it goes on the PayPal payment"],
      [IconGuarantee, "Kart handles shopper issues, so fewer disputes"],
    ],
  },
};

/** Clerk's sign-in form, or "Continue as …" when the person is already signed in with Clerk.
 * (Uses useUser(): Clerk Core 3 removed the <SignedIn>/<SignedOut> components.) */
function ClerkSignInOrContinue({ redirect, continueLabel }: { redirect: string; continueLabel: string }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <SignInSkeleton />;
  return isSignedIn ? <ContinueAs href={redirect} label={continueLabel} /> : <SignIn routing="hash" withSignUp forceRedirectUrl={redirect} signUpForceRedirectUrl={redirect} />;
}

/** Shown instead of Clerk's form when the person is already signed in with Clerk. */
function ContinueAs({ href, label }: { href: string; label: string }) {
  const { user } = useUser();
  const name = user?.firstName || user?.fullName || user?.primaryEmailAddress?.emailAddress || "your account";
  return (
    <div className="rounded-[16px] border border-line bg-surface p-6 text-center shadow-[0_8px_24px_-12px_rgba(11,27,63,0.18)]">
      {user?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.imageUrl} alt="" className="mx-auto h-12 w-12 rounded-full border border-line" />
      ) : (
        <div className="mx-auto h-12 w-12 rounded-full bg-sunken" />
      )}
      <p className="mt-3 text-[15px] font-semibold">You&apos;re signed in as {name}</p>
      <a href={href} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-action text-[14px] font-semibold text-white transition hover:bg-action-hover">
        {label}
      </a>
      <a href="/logout" className="mt-2.5 inline-block text-[12.5px] text-muted hover:text-ink">
        Use a different account
      </a>
    </div>
  );
}

/** Same shape as Clerk's sign-in card, shown while Clerk loads. */
function SignInSkeleton() {
  const bar = "shimmer rounded-md";
  return (
    <div aria-busy="true" aria-label="Loading sign-in" className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_8px_24px_-12px_rgba(11,27,63,0.18)]">
      <div className="px-7 py-7">
        <div className="flex flex-col items-center">
          <div className={`${bar} h-5 w-36`} />
          <div className={`${bar} mt-2.5 h-3.5 w-52`} />
        </div>
        <div className="mt-7 grid grid-cols-2 gap-2">
          <div className="shimmer h-10 rounded-[10px]" />
          <div className="shimmer h-10 rounded-[10px]" />
        </div>
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <div className={`${bar} h-3 w-5`} />
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className={`${bar} h-3.5 w-24`} />
        <div className="shimmer mt-2 h-10 rounded-[10px]" />
        <div className="mt-6 h-10 rounded-[10px] bg-[#0B5ED7]/25" />
      </div>
      <div className="flex justify-center border-t border-line bg-[#f7f9fc] py-4">
        <div className={`${bar} h-3.5 w-44`} />
      </div>
    </div>
  );
}

function LoginInner() {
  const router = useRouter();
  const q = useSearchParams();
  const [role, setRole] = useState<Role>((q.get("as") as Role) === "store" ? "store" : "shopper");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Only follow same-site paths ("/shop"), never "//host" or "/\\host".
  const rawNext = q.get("next");
  const nextParam = rawNext && /^\/(?![\/\\])[^\\\s]*$/.test(rawNext) ? rawNext : null;
  const clerkNext = `/api/session/clerk?next=${encodeURIComponent(nextParam && !nextParam.startsWith("/store") ? nextParam : "/shop")}`;
  const go = async (r: Role, s?: string) => {
    setBusy(true);
    setErr("");
    try {
      await signIn(r, s);
      const fits = nextParam && (r === "store" ? nextParam.startsWith("/store") : !nextParam.startsWith("/store"));
      router.push(fits ? nextParam! : r === "store" ? "/store" : "/shop");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const side = SIDE[role];
  const post = async (body: object, to: string) => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Sign-in failed");
      router.push(to);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const goDemoStore = () => post({ role: "store", demo: true }, "/store");
  const goOwner = () => post({ role: "store" }, "/store/connect");

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="Kart home">
          <Logo />
        </Link>
        <Link href="/" className="text-[13.5px] font-medium text-muted hover:text-ink">
          What is Kart?
        </Link>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-5 pb-16 pt-4 lg:grid-cols-[1fr_400px] lg:items-start lg:gap-16 lg:pt-12">
        {/* left: what you're signing in to */}
        <div className="hidden lg:block lg:pt-16">
          <h1 className="max-w-[18ch] text-balance text-[36px] font-semibold leading-[1.1] tracking-[-0.03em]">{side.title}</h1>
          <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-muted">{side.body}</p>
          <ul className="mt-8 space-y-3.5 text-[14px]">
            {side.points.map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface shadow-[var(--shadow-xs)] ${role === "store" ? "text-violet" : "text-action"}`}>
                  <Icon size={17} />
                </span>
                <span className="text-ink">{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-10 flex items-center gap-2 text-[12.5px] text-subtle">
            Payments by <PayPalLogo height={13} /> <span>Runs on the PayPal sandbox; no real money moves.</span>
          </p>
        </div>

        {/* right: role switch + sign-in */}
        <div className="mx-auto w-full max-w-[400px]">
          <div role="tablist" aria-label="Sign in as" className="grid grid-cols-2 rounded-xl bg-[#e9edf3] p-1">
            {(["shopper", "store"] as Role[]).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={role === r}
                onClick={() => {
                  setRole(r);
                  setErr("");
                }}
                className={`h-9 rounded-[9px] text-[13.5px] font-medium transition ${role === r ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted hover:text-ink"}`}
              >
                {r === "shopper" ? "I’m shopping" : "I’m a store"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {role === "shopper" ? (
              clerkOn ? (
                <>
                  <ClerkLoading>
                    <SignInSkeleton />
                  </ClerkLoading>
                  <ClerkLoaded>
                    <ClerkSignInOrContinue redirect={clerkNext} continueLabel="Continue shopping" />
                  </ClerkLoaded>
                  <div className="mt-4 rounded-[14px] border border-dashed border-line-strong bg-surface/60 p-4 text-center">
                    <p className="text-[13px] text-muted">Judging or just looking around?</p>
                    <button onClick={() => go("shopper")} disabled={busy} className="mt-1 text-[14px] font-semibold text-action hover:underline disabled:opacity-60">
                      {busy ? "Opening the demo…" : "Try the demo without an account"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-[16px] border border-line bg-surface p-7 shadow-[0_8px_24px_-12px_rgba(11,27,63,0.18)]">
                  <h2 className="text-[19px] font-semibold tracking-tight">Sign in to Kart</h2>
                  <p className="mt-1 text-[13.5px] text-muted">Demo sign-in, no account needed.</p>
                  <ul className="mt-5 space-y-1.5 text-[13px] text-muted">
                    {["Pay with your own PayPal, no card details shared", "Kart Guarantee on every order", "Cancel any one-tap order within 10 minutes"].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <Check size={14} className="text-success" /> {t}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-6 w-full" disabled={busy} onClick={() => go("shopper")}>
                    {busy ? "Signing in…" : "Continue as shopper"}
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-3">
                {/* judges and quick testing */}
                <div className="rounded-[16px] border border-line bg-surface p-6 shadow-[0_8px_24px_-12px_rgba(11,27,63,0.18)]">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-tint text-violet">
                      <IconStore size={20} />
                    </span>
                    <div>
                      <h2 className="text-[16px] font-semibold tracking-tight">Try the demo store</h2>
                      <p className="mt-0.5 text-[13px] text-muted">See the store side of the orders you placed as the demo shopper in this browser: ship them, approve claims, settle refunds.</p>
                    </div>
                  </div>
                  <Button className="mt-5 w-full" disabled={busy} onClick={() => goDemoStore()}>
                    {busy ? "Opening…" : "Open the demo store"}
                  </Button>
                </div>

                {/* real store owners */}
                <div className="rounded-[16px] border border-line bg-surface p-6">
                  <h2 className="text-[15px] font-semibold tracking-tight">Own a store?</h2>
                  <p className="mt-0.5 text-[13px] text-muted">Sign in, prove you own your domain, and connect your PayPal business account. Orders are then paid straight into it.</p>
                  {clerkOn ? (
                    <div className="mt-4">
                      <ClerkLoading>
                        <SignInSkeleton />
                      </ClerkLoading>
                      <ClerkLoaded>
                        <ClerkSignInOrContinue redirect="/api/session/clerk?as=store" continueLabel="Open my stores" />
                      </ClerkLoaded>
                    </div>
                  ) : (
                    <Button variant="outline" className="mt-4 w-full" disabled={busy} onClick={() => goOwner()}>
                      Sign in as a store owner
                    </Button>
                  )}
                </div>
              </div>
            )}
            {err && <p className="mt-3 text-center text-[13px] text-danger">{err}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
