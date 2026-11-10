// AG Studio data sources for Kart's insights: orders, every agent decision, and Kart Guarantee paybacks,
// joined to a shared calendar. Field ids like "orders.price" are what the report and the AI refer to.
import type { AgDataSourcesDefinition, AgExpressionFieldDefinition, AgFieldDefinition, AgFormat, AgRelationDefinition } from "ag-studio";

export type InsightsData = {
  asOf: string;
  rules: { autoBuyUnder: number; perItemMax: number; monthlyCap: number; maxOrdersPerHour?: number; mandateActive?: boolean };
  monthSpent: number;
  orders: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  credits: Record<string, unknown>[];
};

type FieldSpec = [id: string, name: string, format: AgFormat, hide?: boolean];
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fields = (specs: FieldSpec[]): AgFieldDefinition[] =>
  specs.map(([id, name, format, hide]) => ({ id, name, format, ...(format === "currencyFormat" && { formatOptions: { format: USD } }), ...(hide && { hide }) }));
const CAL = "calendar";
const onCalendar = (tableId: string, fieldId: string): AgRelationDefinition => ({ id: `${tableId}-${fieldId}-cal`, source: { tableId, fieldId }, target: { calendarId: CAL } });

// Named measures, so charts and tables say "Charged" rather than "Charged (sum)".
const measure = (id: string, name: string, field: string, format: AgFormat, aggregation: "sum" | "countd", description: string): AgExpressionFieldDefinition => ({
  id,
  name,
  description,
  format,
  isMeasure: true,
  ...(format === "currencyFormat" && { formatOptions: { format: USD } }),
  expression: { id: field, aggregation },
});
export const MEASURES: AgExpressionFieldDefinition[] = [
  measure("charged", "Charged", "orders.price", "currencyFormat", "sum", "Total PayPal charged for orders."),
  measure("netSpent", "Net spent", "orders.netSpent", "currencyFormat", "sum", "Charged minus Kart Guarantee paybacks."),
  measure("saved", "Saved vs other stores", "orders.savedVsOtherStores", "currencyFormat", "sum", "How much more the most expensive other store charged for the same products."),
  measure("paidBack", "Paid back", "orders.paidBack", "currencyFormat", "sum", "Money the Kart Guarantee paid back."),
  measure("orderCount", "Orders", "orders.id", "integerFormat", "countd", "Number of orders."),
  measure("decisionCount", "Decisions", "decisions.id", "integerFormat", "countd", "Number of decisions Kart made."),
  measure("decidedAmount", "Amount", "decisions.amount", "currencyFormat", "sum", "Amount the agent asked to spend."),
  measure("autoBuys", "Bought on its own", "decisions.boughtOnItsOwn", "integerFormat", "sum", "Purchases Kart made on its own, under the auto-buy limit."),
  measure("okBuys", "Bought after your OK", "decisions.boughtAfterOk", "integerFormat", "sum", "Purchases the shopper confirmed."),
  measure("stopped", "Stopped", "decisions.blocked", "integerFormat", "sum", "Purchases Kart stopped: a rule or the live price check."),
  measure("liveChecks", "Live price checks", "decisions.liveChecks", "integerFormat", "sum", "Live price checks on Channel3 right before PayPal charged."),
];

export const hasData = (d: InsightsData) => d.orders.length > 0 || d.decisions.length > 0;

export function buildStudioData(d: InsightsData): AgDataSourcesDefinition {
  const today = d.asOf.slice(0, 10);
  const dates = [...d.orders, ...d.decisions, ...d.credits]
    .map((r) => r.date as string | null)
    .filter((x): x is string => !!x)
    .sort();
  return {
    description:
      "Kart: an AI shopping agent (and any connected agent, like Claude Desktop) buys for one shopper with PayPal, inside the shopper's spending rules. " +
      `Rules: buys on its own up to $${d.rules.autoBuyUnder}, asks the shopper up to $${d.rules.perItemMax}, never more than $${d.rules.perItemMax} per item or $${d.rules.monthlyCap} a month. ` +
      "Channel3 compares every store selling the same product; Kart buys from the cheapest in stock and re-checks the live price right before PayPal charges. " +
      "The Kart Guarantee pays the shopper back first (PayPal Payout or refund) for damaged, lost or price-dropped items. All money is USD in the PayPal sandbox.",
    sources: [
      {
        id: "orders",
        description: "One row per paid order. price is what PayPal charged; netSpent subtracts Kart Guarantee paybacks. savedVsOtherStores is how much more the most expensive other store charged for the same product.",
        data: d.orders,
        fields: fields([
          ["id", "Order ID", "textFormat", true],
          ["date", "Order date", "dateFormat"],
          ["product", "Product", "textFormat"],
          ["store", "Store", "textFormat"],
          ["agent", "Asked by", "textFormat"],
          ["status", "Status", "textFormat"],
          ["howPaid", "How it was paid", "textFormat"],
          ["funding", "Paid with", "textFormat"],
          ["route", "Money route", "textFormat"],
          ["price", "Charged", "currencyFormat"],
          ["storesCompared", "Stores compared", "integerFormat"],
          ["savedVsOtherStores", "Saved vs other stores", "currencyFormat"],
          ["paidBack", "Paid back", "currencyFormat"],
          ["netSpent", "Net spent", "currencyFormat"],
          ["paypalTransaction", "PayPal transaction", "textFormat"],
        ]),
      },
      {
        id: "decisions",
        description:
          "One row per decision Kart made for an agent: asked to buy, bought on its own (under the auto-buy limit), bought after the shopper's OK, blocked by a rule, or stopped by the live price check. Sum the 1/0 flag fields to count each outcome.",
        data: d.decisions,
        fields: fields([
          ["id", "Decision ID", "textFormat", true],
          ["date", "Date", "dateFormat"],
          ["time", "Time", "dateTimeFormat", true],
          ["agent", "Agent", "textFormat"],
          ["outcome", "What Kart did", "textFormat"],
          ["rule", "Rule applied", "textFormat"],
          ["amount", "Amount", "currencyFormat"],
          ["reason", "Why", "textFormat"],
          ["orderId", "Order ID", "textFormat", true],
          ["protected", "Stopped money", "booleanFormat", true],
          ["boughtOnItsOwn", "Bought on its own", "integerFormat"],
          ["boughtAfterOk", "Bought after your OK", "integerFormat"],
          ["blocked", "Stopped", "integerFormat"],
          ["liveChecks", "Live price checks", "integerFormat"],
        ]),
      },
      {
        id: "credits",
        description: "Kart Guarantee paybacks: money Kart sent the shopper first (PayPal Payout or refund) before recovering it from the store.",
        data: d.credits,
        fields: fields([
          ["id", "Payback ID", "textFormat", true],
          ["orderId", "Order ID", "textFormat", true],
          ["date", "Paid back on", "dateFormat"],
          ["product", "Product", "textFormat"],
          ["store", "Store", "textFormat"],
          ["kind", "Why", "textFormat"],
          ["amount", "Paid back", "currencyFormat"],
          ["via", "Sent by", "textFormat"],
          ["recoveredFromStore", "Recovered from store", "textFormat"],
        ]),
      },
    ],
    expressions: MEASURES,
    relationships: [onCalendar("orders", "date"), onCalendar("decisions", "date"), onCalendar("credits", "date")],
    calendars: [
      {
        id: CAL,
        label: "Calendar",
        range: { from: { type: "date", value: dates[0] ?? today }, to: { type: "date", value: dates.at(-1) ?? today } },
        fragments: ["year", "quarter", "month", "week", "day", "dayOfWeek"],
      },
    ],
  };
}
