/** Clerk sign-in for shoppers is on when its publishable key is set; otherwise Kart uses one-click demo sign-in. */
export const clerkOn = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/** Clerk theme that matches Kart's UI. Clerk's own card is the sign-in card. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#0B5ED7",
    colorText: "#0a1733",
    colorTextSecondary: "#4f5d73",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#0a1733",
    colorDanger: "#C93A26",
    fontFamily: "inherit",
    borderRadius: "10px",
    fontSize: "14px",
  },
  layout: {
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full max-w-none rounded-[16px] border border-[#e6e9ef] shadow-[0_8px_24px_-12px_rgba(11,27,63,0.18)]",
    card: "w-full shadow-none px-7 py-7",
    headerTitle: "text-[19px] font-semibold tracking-tight",
    headerSubtitle: "text-[13.5px]",
    socialButtonsBlockButton: "h-10 border-[#e6e9ef] shadow-none",
    formFieldInput: "h-10",
    formButtonPrimary: "h-10 text-[14px] font-semibold normal-case shadow-none",
    footer: "bg-[#f7f9fc]",
  },
} as const;

/** Kart wording inside Clerk's forms. */
export const clerkLocalization = {
  signIn: {
    start: {
      title: "Sign in to Kart",
      titleCombined: "Sign in to Kart",
      subtitle: "Pick up where your agent left off",
      subtitleCombined: "New here? We’ll create your account",
    },
  },
  signUp: {
    start: {
      title: "Create your Kart account",
      subtitle: "Shop with an agent that stays inside your limits",
    },
  },
};
