"use client";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useApp } from "./app-context";

/** Loads the PayPal JS SDK once the client id is known (fetched at runtime from /api/status). */
export function PayPalProvider({ children }: { children: React.ReactNode }) {
  const { status } = useApp();
  if (!status?.paypal || !status.clientId) return <>{children}</>;
  return (
    <PayPalScriptProvider
      options={{
        clientId: status.clientId,
        currency: "USD",
        intent: "capture",
        components: "buttons,messages",
        enableFunding: "paylater",
        disableFunding: "card",
        ...(status.sandbox ? { buyerCountry: "US" } : {}),
      }}
    >
      {children}
    </PayPalScriptProvider>
  );
}
