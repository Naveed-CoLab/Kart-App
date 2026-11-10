import type { DB } from "./types";

export const DB_VERSION = 2;

/** A fresh, empty store. Everything shown in Kart comes from real searches, payments and actions. */
export function emptyDb(): DB {
  return {
    version: DB_VERSION,
    rules: { autoBuyUnder: 30, perItemMax: 50, monthlyCap: 200, currency: "USD", vaultId: null, paypalCustomerId: null, payerEmail: null, payerName: null, shipTo: null, maxOrdersPerHour: 5, mandateActive: false },
    products: {},
    searchCache: {},
    orders: [],
    claims: [],
    events: [],
    watches: [],
    approvals: {},
    chats: {},
    stores: {},
  };
}
