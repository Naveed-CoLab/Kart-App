// Tailwind v3-style config loaded by Tailwind v4 via `@config` in app/globals.css.
// Registers the Lemon Squeezy Wedges plugin with Kart's PayPal-blue primary scale.
import { wedgesTW } from "@lemonsqueezy/wedges";

const paypalBlue = {
  50: "#eef6ff",
  100: "#d9eafe",
  200: "#bcdafd",
  300: "#8ec3fb",
  400: "#59a3f7",
  500: "#2f84f1",
  600: "#0070e0",
  700: "#005cc0",
  800: "#004a9c",
  900: "#003087",
  DEFAULT: "#0070e0",
};

/**
 * Wedges was written for Tailwind v3 and registers theme CSS variables with addUtilities(':where(:root)').
 * Tailwind v4 only allows single-class utilities, so route any non-class selector to addBase instead.
 */
function v4Compatible(plugin) {
  const isUtility = (sel) => /^\.[a-z][\w-]*$/i.test(sel.trim());
  const split = (input, api, opts) => {
    const list = Array.isArray(input) ? input : [input];
    for (const obj of list) {
      const base = {};
      const utils = {};
      for (const [sel, val] of Object.entries(obj || {})) (isUtility(sel) ? utils : base)[sel] = val;
      if (Object.keys(base).length) api.addBase(base);
      if (Object.keys(utils).length) api.addUtilities(utils, opts);
    }
  };
  return {
    ...plugin,
    handler: (api) => plugin.handler({ ...api, addUtilities: (u, o) => split(u, api, o), addComponents: (u, o) => split(u, api, o) }),
  };
}

const wedges = v4Compatible(
  wedgesTW({
    themes: {
      light: { colors: { primary: paypalBlue } },
    },
  }),
);

/** Tailwind v4 doesn't accept v3 color functions; resolve them to plain CSS color strings. */
function resolveColorFns(extend) {
  const colors = {};
  for (const [k, v] of Object.entries(extend.colors || {})) colors[k] = typeof v === "function" ? `hsl(var(--wg-${k}) / <alpha-value>)` : v;
  return { ...extend, colors };
}

/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./node_modules/@lemonsqueezy/wedges/dist/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  // Tailwind v4 ignores config returned by plugins, so merge Wedges' theme extension here.
  theme: { extend: resolveColorFns(wedges.config?.theme?.extend || {}) },
  plugins: [wedges],
};

export default config;
