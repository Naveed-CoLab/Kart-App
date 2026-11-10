/**
 * Kart custom icon set: 24px grid, 1.75 stroke, rounded caps, duotone (tinted fill + stroke).
 * Used for the product's signature concepts; Lucide stays for generic UI chrome.
 */
type P = { size?: number; className?: string; title?: string };

function Svg({ size = 24, className = "", title, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}
const tint = { fill: "currentColor", fillOpacity: 0.14, stroke: "none" } as const;

/** Kart Guarantee: shield with a check. */
export const IconGuarantee = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.8 4.5 5.6v5.9c0 4.6 3.1 8.2 7.5 9.7 4.4-1.5 7.5-5.1 7.5-9.7V5.6z" {...tint} />
    <path d="M12 2.8 4.5 5.6v5.9c0 4.6 3.1 8.2 7.5 9.7 4.4-1.5 7.5-5.1 7.5-9.7V5.6z" />
    <path d="m8.6 12 2.4 2.4 4.6-4.8" />
  </Svg>
);
/** Auto-buy: bolt inside a rounded square. */
export const IconAutoBuy = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5.5" {...tint} />
    <rect x="3" y="3" width="18" height="18" rx="5.5" />
    <path d="M12.9 6.5 8.6 12.6h3.3l-.9 4.9 4.4-6.2h-3.3z" />
  </Svg>
);
/** Spending rules: three slider stops. */
export const IconRules = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="5" {...tint} />
    <path d="M7 9h10M7 15h10" />
    <circle cx="10" cy="9" r="1.8" fill="white" />
    <circle cx="14.5" cy="15" r="1.8" fill="white" />
  </Svg>
);
/** Price Guard: tag with a down arrow. */
export const IconPriceGuard = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 12.3V4.8c0-.7.6-1.3 1.3-1.3h7.5l8.2 8.2a1.3 1.3 0 0 1 0 1.8l-7.5 7.5a1.3 1.3 0 0 1-1.8 0z" {...tint} />
    <path d="M3.5 12.3V4.8c0-.7.6-1.3 1.3-1.3h7.5l8.2 8.2a1.3 1.3 0 0 1 0 1.8l-7.5 7.5a1.3 1.3 0 0 1-1.8 0z" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    <path d="M13.2 10.4v5M11 13.2l2.2 2.2 2.2-2.2" />
  </Svg>
);
/** Search across stores: magnifier over a grid. */
export const IconDiscover = (p: P) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" {...tint} />
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 4.5 4.5" />
    <path d="M8 10.5h5M10.5 8v5" />
  </Svg>
);
/** Pay: wallet with card. */
export const IconPay = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="3.5" {...tint} />
    <rect x="3" y="6" width="18" height="13" rx="3.5" />
    <path d="M6 6 15.5 3.4a1.4 1.4 0 0 1 1.7 1V6" />
    <path d="M16 12.5h2.5" />
  </Svg>
);
/** Shipping: parcel. */
export const IconParcel = (p: P) => (
  <Svg {...p}>
    <path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2z" {...tint} />
    <path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2z" />
    <path d="M4 7.2 12 11.4l8-4.2M12 11.4V21M8 5.1l8 4.2" />
  </Svg>
);
/** Damage claim: camera with a crack. */
export const IconClaim = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6.5" width="18" height="13" rx="3.5" {...tint} />
    <path d="M8.5 6.5 9.8 4.5h4.4l1.3 2H18a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z" />
    <path d="m11.2 10.2 1.6 2.1-1.6 1.3 1.6 2.2" />
  </Svg>
);
/** Money back: coin with return arrow. */
export const IconMoneyBack = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" {...tint} />
    <path d="M20.5 12A8.5 8.5 0 1 1 17 5.1" />
    <path d="M17.5 2.8V5.6h-2.8" />
    <path d="M13.8 9.6c-.4-.6-1.1-.9-1.9-.9-1.1 0-1.9.6-1.9 1.5 0 2 3.9 1.1 3.9 3.2 0 .9-.9 1.5-2 1.5-.8 0-1.6-.4-2-1M12 7.6v1.1M12 15v1.2" />
  </Svg>
);
/** Store. */
export const IconStore = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 10v9.5h15V10" {...tint} />
    <path d="M4.5 10v9.5h15V10M3.5 5.5 5 3.5h14l1.5 2 .5 2.3a2.6 2.6 0 0 1-5 .9 2.6 2.6 0 0 1-4.9 0 2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5-.9z" />
    <path d="M10 19.5v-4.5h4v4.5" />
  </Svg>
);

/**
 * Kart mark: a "K" drawn as a shopping cart (handle, basket, two wheels). Flat, no gradients.
 * tone: "blue" (default tile), "ink" (dark tile), "light" (white tile for dark/blue backgrounds), "bare" (glyph only).
 * thinking: the two wheels pulse like a typing indicator while the agent works.
 */
export function KartMark({ size = 28, tone = "blue", thinking = false, className = "" }: { size?: number; tone?: "blue" | "ink" | "light" | "bare"; thinking?: boolean; className?: string }) {
  const tile = { blue: "#0B5ED7", ink: "#0B1B3F", light: "#FFFFFF", bare: "none" }[tone];
  const fg = tone === "light" || tone === "bare" ? "#0B5ED7" : "#FFFFFF";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className}`} role="img" aria-label="Kart">
      {tone !== "bare" && <rect width="32" height="32" rx="9" fill={tile} />}
      <path d="M8.6 6.3h3v13.4m0-6.1 9.8-7.3m-6.3 5 7.3 8.4H11.6" fill="none" stroke={fg} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13.6" cy="24.6" r="1.95" fill={fg} className={thinking ? "kart-wheel" : undefined} />
      <circle cx="20.6" cy="24.6" r="1.95" fill={fg} className={thinking ? "kart-wheel kart-wheel-2" : undefined} />
    </svg>
  );
}

/** Back-compat name used across the app. */
export function KartOrb({ size = 28, thinking = false, tone }: { size?: number; thinking?: boolean; tone?: "blue" | "ink" | "light" | "bare" }) {
  return <KartMark size={size} thinking={thinking} tone={tone} />;
}

/** PayPal wordmark-style label for "secured by" strips (text only; not the official logo asset). */
export function PayPalText({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold italic tracking-tight ${className}`}>
      <span className="text-[#003087]">Pay</span>
      <span className="text-[#0070e0]">Pal</span>
    </span>
  );
}
