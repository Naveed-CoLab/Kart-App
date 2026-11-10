"use client";
import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

/** Ends the Clerk session too (only rendered when Clerk is on). */
export function ClerkSignOutNow() {
  const { signOut } = useClerk();
  useEffect(() => {
    signOut({ redirectUrl: "/" });
  }, [signOut]);
  return null;
}
