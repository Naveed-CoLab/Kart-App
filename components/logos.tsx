"use client";
/**
 * Real brand marks for identification (nominative use): PayPal, Claude and known stores come from the
 * `simple-icons` library (official brand SVG paths + brand colors). Any other store falls back to its own
 * site favicon, then to initials via the Wedges Avatar.
 */
import { useState } from "react";
import { Avatar } from "@lemonsqueezy/wedges";
import { siAdidas, siApple, siClaude, siEbay, siEtsy, siIkea, siNike, siPaypal, siSamsung, siTarget, siUnderarmour, siUniqlo, siZara, type SimpleIcon } from "simple-icons";

const STORE_ICONS: Record<string, SimpleIcon> = {
  "target.com": siTarget,
  "etsy.com": siEtsy,
  "uniqlo.com": siUniqlo,
  "ikea.com": siIkea,
  "ebay.com": siEbay,
  "nike.com": siNike,
  "adidas.com": siAdidas,
  "apple.com": siApple,
  "samsung.com": siSamsung,
  "underarmour.com": siUnderarmour,
  "zara.com": siZara,
};

const clean = (domain: string) => domain.toLowerCase().replace(/^www\./, "");
const initials = (domain: string) => clean(domain).replace(/\..*$/, "").slice(0, 2).toUpperCase();

function BrandGlyph({ icon, size, color }: { icon: SimpleIcon; size: number; color?: string }) {
  const hex = color || (icon.hex.toUpperCase() === "FFFFFF" ? "111111" : icon.hex);
  return (
    <svg role="img" aria-label={icon.title} viewBox="0 0 24 24" width={size} height={size} fill={`#${hex}`}>
      <path d={icon.path} />
    </svg>
  );
}

/** Store logo: brand mark if known, otherwise the store's favicon, otherwise initials. */
export function StoreLogo({ domain, size = 28, className = "" }: { domain: string; size?: number; className?: string }) {
  const d = clean(domain);
  const icon = STORE_ICONS[d];
  const [failed, setFailed] = useState(false);
  const box = `inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-white ${className}`;
  if (icon)
    return (
      <span className={box} style={{ width: size, height: size }} title={d}>
        <BrandGlyph icon={icon} size={Math.round(size * 0.56)} />
      </span>
    );
  if (failed)
    return (
      <span className={`${box} bg-sunken text-[10px] font-semibold text-muted`} style={{ width: size, height: size, fontSize: Math.max(9, size * 0.36) }} title={d}>
        {initials(d)}
      </span>
    );
  return (
    <span className={box} style={{ width: size, height: size }} title={d}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`} alt={`${d} logo`} width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} onError={() => setFailed(true)} referrerPolicy="no-referrer" />
    </span>
  );
}

/** Store logo + name, for table cells and card meta rows. */
export function StoreName({ domain, size = 18, className = "" }: { domain: string; size?: number; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <StoreLogo domain={domain} size={size} />
      <span className="truncate">{clean(domain)}</span>
    </span>
  );
}

/**
 * Official PayPal artwork lives in /public/brand (download it from PayPal's media resources page):
 *   - paypal-logo.png  : PayPal 2024 wordmark (black), from PayPal Newsroom media resources
 *   - paypal-mark.png  : PayPal 2024 monogram (full color), from PayPal Newsroom media resources
 * If a file is missing, these components fall back to the simple-icons monogram so nothing breaks.
 */
const PP_LOGO = "/brand/paypal-logo.png";
const PP_MARK = "/brand/paypal-mark.png";

/** PayPal mark ("P"). */
export function PayPalMark({ size = 16, className = "" }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={`inline-grid place-items-center ${className}`}>
        <BrandGlyph icon={siPaypal} size={size} />
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={PP_MARK} alt="PayPal" height={size} style={{ height: size, width: "auto" }} className={`inline-block ${className}`} onError={() => setFailed(true)} />
  );
}

/** Full PayPal logo (official wordmark). */
export function PayPalLogo({ height = 16, className = "" }: { height?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={`inline-flex items-center gap-1 ${className}`} aria-label="PayPal">
        <BrandGlyph icon={siPaypal} size={height} />
        <span className="font-extrabold italic leading-none tracking-[-0.02em]" style={{ fontSize: height * 0.95 }}>
          <span className="text-[#002991]">Pay</span>
          <span className="text-[#0070e0]">Pal</span>
        </span>
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={PP_LOGO} alt="PayPal" height={height} style={{ height, width: "auto" }} className={`inline-block align-middle ${className}`} onError={() => setFailed(true)} />
  );
}

/** Payment-method chip used in tables (card-network style). */
export function PayPalMethodChip() {
  return (
    <span className="inline-grid h-6 w-9 place-items-center rounded-md border border-line bg-white shadow-[var(--shadow-xs)]">
      <PayPalMark size={13} />
    </span>
  );
}

export function ClaudeMark({ size = 14 }: { size?: number }) {
  return <BrandGlyph icon={siClaude} size={size} />;
}

/** User avatar via Wedges. */
export function UserAvatar({ name = "Guest", size = "sm" as const }: { name?: string; size?: "xs" | "sm" | "md" }) {
  const init = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return <Avatar size={size} initials={init.slice(0, 1)} alt={name} status="green" />;
}

// Re-export for one-stop imports
export { Avatar };
// Unused-yet brand marks kept tree-shakable through STORE_ICONS above.
export const knownStore = (domain: string) => Boolean(STORE_ICONS[clean(domain)]);
