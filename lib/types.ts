export type Product = {
  id: string;
  title: string;
  brand?: string;
  store: string;
  price: number;
  compareAt?: number | null;
  rating?: number | null;
  reviews?: number | null;
  image?: string | null;
  url?: string | null;
  features?: string[];
  description?: string;
  source: "channel3";
  /** Every store Channel3 found selling this exact product, cheapest first (in stock only). */
  offers?: Offer[];
  /** Brand commission rate on the chosen offer (Channel3 max_commission_rate, 0.05 = 5%). */
  commission?: number | null;
  /** When Kart last checked the live price on Channel3. */
  checkedAt?: string;
};

export type Offer = { store: string; price: number; url: string | null };

export type Rules = {
  autoBuyUnder: number;
  perItemMax: number;
  monthlyCap: number;
  currency: "USD";
  vaultId?: string | null;
  paypalCustomerId?: string | null;
  payerEmail?: string | null;
  payerName?: string | null;
  shipTo?: string | null;
  maxOrdersPerHour?: number;
  mandateActive: boolean;
};

export type OrderStatus = "created" | "paid" | "shipped" | "delivered" | "refunded" | "claim_review";

/** Money Kart sends back to the shopper under the Kart Guarantee. */
export type GuaranteeCredit = {
  id: string;
  kind: "claim" | "price_drop" | "undo" | "lost";
  amount: number;
  via: "payout" | "refund";
  ref: string;
  at: string;
  recovered: boolean;
};

export type StoreOrder = {
  number: string;
  mode: "demo" | "live";
  placedAt: string;
  url: string;
  steps: { label: string; at: string }[];
};

export type Order = {
  id: string;
  chatId?: string | null;
  productId: string;
  title: string;
  store: string;
  image?: string | null;
  price: number;
  /** Who received the shopper's money: the store directly (PayPal payee) or Kart, which paid the store at once via Payouts. */
  merchant: "store" | "kart";
  payee?: string | null;
  payerEmail?: string | null;
  paypalOrderId?: string | null;
  paypalCaptureId?: string | null;
  storePayoutBatchId?: string | null;
  /** The order Kart placed on the store's website (simulated in sandbox). */
  storeOrder?: StoreOrder | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  lastPriceCheck?: { price: number; at: string } | null;
  status: OrderStatus;
  buyMode: "popup" | "auto" | "confirmed";
  /** Which agent asked for this purchase: "Kart chat", or a connected agent like "Claude Desktop". */
  agent?: string | null;
  /** The connected agent's key id, for per-agent budgets. */
  agentKeyId?: string | null;
  /** How many stores Channel3 found selling this exact product, and the highest price among them. */
  storesCompared?: number | null;
  highestStorePrice?: number | null;
  fundingSource?: string | null;
  fee?: number | null;
  credits: GuaranteeCredit[];
  createdAt: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  refundedAt?: string | null;
};

export type Claim = {
  id: string;
  orderId: string;
  reason: string;
  imagePath?: string | null;
  vision: VisionResult;
  riskScore: number;
  reasons: string[];
  decision: "auto_refund" | "store_review";
  refundId?: string | null;
  createdAt: string;
};

export type VisionResult = {
  damage_visible: boolean;
  matches_product: boolean;
  confidence: number;
  summary: string;
};

export type EventType =
  | "search"
  | "decision"
  | "approval"
  | "payment"
  | "auto_buy"
  | "shipment"
  | "delivery"
  | "store_paid"
  | "store_order"
  | "guarantee"
  | "recovery"
  | "price_drop"
  | "claim"
  | "webhook"
  | "blocked"
  | "watch"
  | "rules";

export type KartEvent = {
  id: string;
  orderId?: string | null;
  type: EventType;
  amount?: number | null;
  rule?: string | null;
  reason: string;
  ref?: string | null;
  /** Which agent the action was for ("Kart chat", "Claude Desktop"…). */
  agent?: string | null;
  createdAt: string;
};

export type Watch = {
  id: string;
  productId: string;
  title: string;
  targetPrice: number;
  status: "watching" | "bought" | "cancelled";
  lastPrice?: number;
  createdAt: string;
};

/** Items rendered in the chat transcript. */
export type UIItem =
  | { id: string; kind: "user"; text: string; image?: string | null }
  | { id: string; kind: "assistant"; text: string }
  | {
      id: string;
      kind: "step";
      label: string;
      tool: string;
      /** What exactly happened, from the decision trail (or Claude's own reasoning when thought is true). */
      detail?: string;
      tone?: "info" | "ok" | "stop" | "money";
      thought?: boolean;
      at?: string;
    }
  | { id: string; kind: "products"; products: Product[]; reasons: Record<string, string>; bestPickId: string }
  | {
      id: string;
      kind: "approval";
      product: Product;
      decision: "auto" | "needs_approval";
      rule: string;
      state: "pending" | "paid";
      orderId?: string;
    }
  | { id: string; kind: "blocked"; product: Product; reason: string }
  | { id: string; kind: "order"; order: Order; auto?: boolean }
  | { id: string; kind: "claim"; claim: Claim; order: Order }
  | { id: string; kind: "notice"; tone: "info" | "success" | "warning"; title: string; text: string; orderId?: string }
  | { id: string; kind: "watch"; watch: Watch };

export type Chat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  /** Set when a connected agent (MCP) started this chat, e.g. "Claude Desktop". */
  agent?: string;
  agentKeyId?: string;
  pinned?: boolean;
  ui: UIItem[];
  // Anthropic message history (content blocks), stored as plain JSON.
  history: unknown[];
  notes: string[];
  lastImage?: { path: string; mediaType: string } | null;
};

export type DB = {
  version?: number;
  rules: Rules;
  products: Record<string, Product & { fetchedAt: string }>;
  searchCache: Record<string, { ids: string[]; at: string }>;
  orders: Order[];
  claims: Claim[];
  events: KartEvent[];
  watches: Watch[];
  approvals: Record<string, { used: boolean; exp: number }>;
  chats: Record<string, Chat>;
  /** Store accounts (only in the platform record). Keyed by domain. */
  stores?: Record<string, StoreAccount>;
  /** Agent keys (only in the platform record), keyed by the key's hash. */
  agentKeys?: Record<string, AgentKey>;
};

/** A key that lets an outside AI agent (Claude Desktop, ChatGPT…) shop through Kart for one shopper. */
export type AgentKey = {
  id: string;
  hash: string;
  tenant: string;
  label: string;
  hint: string;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  /** Least privilege: what this one agent may do, on top of the shopper's own rules. */
  canBuy?: boolean; // false = search and read only
  canAutoBuy?: boolean; // may pay on its own under the auto-buy limit (off by default: every buy needs your OK)
  monthlyBudget?: number; // most this agent may spend in a calendar month
  expiresAt?: string | null; // key stops working after this
};

/** A store on Kart: who owns it, how they proved it, and where its PayPal money goes. */
export type StoreAccount = {
  domain: string;
  ownerUid: string;
  ownerName: string;
  verifyToken: string;
  verified: boolean;
  verifiedBy?: "dns" | "file" | null;
  verifiedAt?: string | null;
  paypalEmail?: string | null;
  merchantId?: string | null; // from PayPal partner sign-up
  paypalConnectedAt?: string | null;
  createdAt: string;
};
