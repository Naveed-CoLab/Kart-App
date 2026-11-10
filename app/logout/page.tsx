"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/components/session";
import { ClerkSignOutNow } from "@/components/ClerkSignOutNow";
import { KartMark } from "@/components/icons";

const clerkOn = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function Logout() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  useEffect(() => {
    signOut().then(() => {
      setDone(true);
      if (!clerkOn) router.replace("/");
    });
  }, [router]);
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3 text-[14px] text-muted">
        <KartMark size={36} thinking />
        Signing you out…
      </div>
      {done && clerkOn && <ClerkSignOutNow />}
    </div>
  );
}
