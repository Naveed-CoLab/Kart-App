// Kart's default insights report: two pages, "Spending" and "Agent decisions", as AG Studio state.
// Field ids refer to ./data.ts. Layout is a 24-column grid; rows are studioCanvasRowHeight tall.
import type { AgPageState, AgReportState, AgWidgetLayoutState } from "ag-studio";

const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const title = (text: string, subtitle?: string) => ({ title: { enabled: true, text }, ...(subtitle && { subtitle: { enabled: true, text: subtitle } }) });
const FONT = "Inter, ui-sans-serif, system-ui, sans-serif";
const type = (fontSize: number, fontWeight: "normal" | "bold" = "normal") => ({ fontFamily: FONT, fontSize, fontWeight, fontStyle: "normal" as const });

const kpi = (text: string, value: { id: string }, sparklineX?: string) => ({
  type: "value" as const,
  dataMapping: { value: [value], ...(sparklineX && { sparklineX: [{ id: sparklineX }] }) },
  format: {
    title: { enabled: true, text, typography: type(13, "bold") },
    caption: { enabled: true, text: "", typography: type(0) },
    style: { typography: type(24) },
  },
});

const m = (id: string) => ({ id });
const legend = (position: "bottom" | "right") => ({ theme: { common: { legend: { enabled: true, position } } } });
// A single-series bar list: every label readable, no legend needed.
const bars = (text: string, category: string, value: string) => ({
  type: "bar-chart-grouped" as const,
  dataMapping: { categoryKey: [{ id: category }], valueKey: [m(value)] },
  sort: [{ field: m(value), direction: "desc" as const }],
  format: { ...title(text), style: { theme: { common: { legend: { enabled: false } } } } },
});
const grid = (text: string, cols: { id: string }[], sortBy: string) => ({
  type: "grid" as const,
  dataMapping: { cols },
  sort: [{ field: { id: sortBy }, direction: "desc" as const }],
  format: { ...title(text), style: { columnAutoSize: true } },
});

const spending: AgPageState = {
  id: "spending",
  widgets: {
    "kpi-spent": kpi("Net spent", m("netSpent"), "calendar::day"),
    "kpi-orders": kpi("Orders", m("orderCount")),
    "kpi-saved": kpi("Saved vs other stores", m("saved")),
    "kpi-back": kpi("Paid back", m("paidBack")),
    // Kart's custom widget (./GuardrailWidget.tsx); the report type only knows Studio's built-in ids.
    guardrail: { type: "kart-guardrail", format: title("Your rules right now") } as unknown as NonNullable<AgPageState["widgets"]>[string],
    "by-store": {
      type: "bar-chart-grouped",
      dataMapping: { categoryKey: [{ id: "orders.store" }], valueKey: [m("charged"), m("saved")] },
      format: { ...title("Charged and saved, by store"), style: legend("bottom") },
    },
    "how-paid": bars("How PayPal was used", "orders.howPaid", "charged"),
    orders: grid(
      "Every order, with its PayPal transaction",
      [{ id: "orders.date" }, { id: "orders.product" }, { id: "orders.store" }, { id: "orders.agent" }, { id: "orders.howPaid" }, m("charged"), m("saved"), { id: "orders.paypalTransaction" }],
      "orders.date",
    ),
  },
  widgetLayout: {
    "kpi-spent": at(0, 0, 6, 7),
    "kpi-orders": at(6, 0, 6, 7),
    "kpi-saved": at(12, 0, 6, 7),
    "kpi-back": at(18, 0, 6, 7),
    guardrail: at(0, 7, 7, 18),
    "by-store": at(7, 7, 9, 18),
    "how-paid": at(16, 7, 8, 18),
    orders: at(0, 25, 24, 21),
  },
};

const agents: AgPageState = {
  id: "agents",
  widgets: {
    "kpi-auto": kpi("Bought on its own", m("autoBuys")),
    "kpi-ok": kpi("Bought after your OK", m("okBuys")),
    "kpi-blocked": kpi("Stopped", m("stopped")),
    "kpi-live": kpi("Live price checks", m("liveChecks")),
    "by-agent": {
      type: "column-chart-stacked",
      dataMapping: { categoryKey: [{ id: "decisions.agent" }], valueKey: [m("decisionCount")], legendKey: [{ id: "decisions.outcome" }] },
      format: { ...title("What each agent asked for, and what Kart did"), style: legend("right") },
    },
    "by-rule": bars("Which rule decided", "decisions.rule", "decisionCount"),
    trail: grid(
      "Decision trail: every request and why",
      [{ id: "decisions.date" }, { id: "decisions.agent" }, { id: "decisions.outcome" }, { id: "decisions.rule" }, m("decidedAmount"), { id: "decisions.reason" }],
      "decisions.date",
    ),
  },
  widgetLayout: {
    "kpi-auto": at(0, 0, 6, 7),
    "kpi-ok": at(6, 0, 6, 7),
    "kpi-blocked": at(12, 0, 6, 7),
    "kpi-live": at(18, 0, 6, 7),
    "by-agent": at(0, 7, 14, 20),
    "by-rule": at(14, 7, 10, 20),
    trail: at(0, 27, 24, 25),
  },
};

export const PAGES = [
  { id: "spending", title: "Spending" },
  { id: "agents", title: "Agent decisions" },
];

export const insightsReport: AgReportState = { selectedPageId: spending.id, pages: [spending, agents] };
