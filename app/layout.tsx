import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "@fontsource-variable/inter";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { clerkAppearance, clerkLocalization, clerkOn } from "@/lib/clerk";

export const metadata: Metadata = {
  title: "Kart · AI shopping agent you can trust with money",
  description: "Kart buys within your rules, pays with PayPal, and pays you back first when something goes wrong.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
  // Clerk is optional: without keys, Kart keeps its one-click demo sign-in.
  return clerkOn ? <ClerkProvider appearance={clerkAppearance} localization={clerkLocalization}>{body}</ClerkProvider> : body;
}
