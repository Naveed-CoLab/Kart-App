"use client";
// Kart insights: an AG Studio dashboard of everything AI agents did with the shopper's money,
// with Kart's own guardrail widget and a Claude-powered assistant (AG Studio Agent Framework).
import { useEffect, useMemo, useRef, useState } from "react";
import { AgStudioAiModule, type AgReportState, type AgStudioApi, type AgStudioMode } from "ag-studio";
import { AgStudio, AgStudioProvider, createWidgets } from "ag-studio-react";
import { Check, LayoutDashboard, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { buildKartAi } from "./ai";
import { buildStudioData, hasData, type InsightsData } from "./data";
import { guardrailWidget, type GuardrailContext } from "./GuardrailWidget";
import { insightsReport, PAGES } from "./report";
import { kartStudioTheme } from "./theme";

const STORE_KEY = "kart-insights-layout-v2";
const loadSaved = (): AgReportState | null => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as AgReportState) : null;
  } catch {
    return null;
  }
};

export default function InsightsDashboard({ licenseKey, aiEnabled }: { licenseKey?: string; aiEnabled: boolean }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState("");
  // view: a fixed, read-only dashboard. customize: Studio's edit panels. ai: only the AI panel.
  const [panel, setPanel] = useState<"view" | "customize" | "ai">("view");
  const mode: AgStudioMode = panel === "view" ? "view" : "edit";
  const [page, setPage] = useState(PAGES[0].id);
  const [saved, setSaved] = useState(false);
  const apiRef = useRef<AgStudioApi | null>(null);
  const ctxRef = useRef<GuardrailContext | null>(null);

  useEffect(() => {
    fetch("/api/insights", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error) : setData(j)))
      .catch((e) => setError(String(e)));
  }, []);

  const context = useMemo<GuardrailContext | null>(() => {
    if (!data) return null;
    const n = (k: string) => data.decisions.reduce((t, d) => t + (Number(d[k]) || 0), 0);
    return { rules: data.rules, monthSpent: data.monthSpent, counts: { auto: n("boughtOnItsOwn"), ok: n("boughtAfterOk"), stopped: n("blocked") } };
  }, [data]);
  ctxRef.current = context;
  const studioData = useMemo(() => (data ? buildStudioData(data) : null), [data]);
  // Always opens as a fixed view, filters folded away.
  const [initialState] = useState<AgReportState>(() => {
    const base = loadSaved() ?? insightsReport;
    return { ...base, panels: { filters: { collapsed: true }, ai: { collapsed: true }, edit: { collapsed: true }, data: { collapsed: true } } } as AgReportState;
  });
  // Leaving the page puts Kart's sidebar back the way it was.
  useEffect(() => () => void window.dispatchEvent(new CustomEvent("kart:sidebar", { detail: "restore" })), []);
  const ai = useMemo(() => (aiEnabled ? buildKartAi(() => ctxRef.current) : undefined), [aiEnabled]);

  const goTo = (id: string) => {
    setPage(id);
    const api = apiRef.current;
    if (api) api.setState({ ...api.getState(), selectedPageId: id });
  };
  // Studio panels for each mode. AG Studio shows its AI panel in edit mode only, so "Ask Kart AI"
  // opens edit mode with every other panel folded away, and folds Kart's sidebar to give it room.
  const setPanels = (open: { ai: boolean; edit: boolean; data: boolean }) => {
    const api = apiRef.current;
    if (!api) return;
    const st = api.getState();
    api.setState({
      ...st,
      panels: {
        ...st.panels,
        ai: { ...st.panels?.ai, collapsed: !open.ai },
        edit: { ...st.panels?.edit, collapsed: !open.edit },
        data: { ...st.panels?.data, collapsed: !open.data },
        filters: { ...st.panels?.filters, collapsed: true },
      },
    } as AgReportState);
  };
  const openAi = () => {
    setPanel("ai");
    window.dispatchEvent(new CustomEvent("kart:sidebar", { detail: "collapse" }));
    setTimeout(() => setPanels({ ai: true, edit: false, data: false }), 50);
  };
  const customize = () => {
    setPanel("customize");
    window.dispatchEvent(new CustomEvent("kart:sidebar", { detail: "collapse" }));
    setTimeout(() => setPanels({ ai: false, edit: true, data: true }), 50);
  };
  const done = () => {
    setPanel("view");
    window.dispatchEvent(new CustomEvent("kart:sidebar", { detail: "restore" }));
  };
  const save = () => {
    const api = apiRef.current;
    if (!api) return;
    try {
      // Save the layout only, not which panels were open.
      const { panels: _p, ...rest } = api.getState() as AgReportState & { panels?: unknown };
      void _p;
      localStorage.setItem(STORE_KEY, JSON.stringify(rest));
    } catch {}
    setPanel("view");
    window.dispatchEvent(new CustomEvent("kart:sidebar", { detail: "restore" }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };
  const reset = () => {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
    apiRef.current?.setState({ ...insightsReport, selectedPageId: page });
    apiRef.current?.clearHistory();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-2.5">
        <div className="mr-auto min-w-0">
          <h1 className="flex items-center gap-2 truncate text-[15px] font-semibold">
            <LayoutDashboard size={16} className="shrink-0 text-action" /> Agent spending insights
          </h1>
          <p className="hidden truncate text-[12.5px] text-muted xl:block">What your agents asked to buy, what Kart did, and what PayPal paid.</p>
        </div>
        <div role="tablist" className="inline-flex shrink-0 rounded-lg bg-[#e9edf3] p-1 text-[12.5px]">
          {PAGES.map((p) => (
            <button key={p.id} role="tab" aria-selected={page === p.id} onClick={() => goTo(p.id)} className={`h-7 whitespace-nowrap rounded-md px-3 font-medium ${page === p.id ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted hover:text-ink"}`}>
              {p.title}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {panel === "customize" ? (
            <>
              <button onClick={reset} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-muted hover:bg-sunken hover:text-ink">
                <RotateCcw size={13} /> Reset
              </button>
              <button onClick={done} className="inline-flex h-8 items-center rounded-lg px-2.5 text-[12.5px] text-muted hover:bg-sunken hover:text-ink">
                Cancel
              </button>
              <button onClick={save} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-action px-3 text-[12.5px] font-medium text-white hover:bg-action-hover">
                <Check size={13} /> Save layout
              </button>
            </>
          ) : panel === "ai" ? (
            <button onClick={done} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium text-ink hover:border-line-strong">
              <Check size={13} /> Done
            </button>
          ) : (
            <>
              <button onClick={customize} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium text-ink hover:border-line-strong">
                {saved ? <Check size={13} className="text-success" /> : <Pencil size={13} />} {saved ? "Saved" : "Customize"}
              </button>
              {aiEnabled && (
                <button onClick={openAi} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] transition hover:opacity-90">
                  <Sparkles size={13} /> Ask Kart AI
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {error ? (
          <p className="m-6 rounded-xl bg-danger-tint px-4 py-3 text-[13px] text-danger">{error}</p>
        ) : !data || !studioData ? (
          <div className="grid grid-cols-4 gap-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-24 rounded-[14px]" />
            ))}
            <div className="shimmer col-span-4 h-72 rounded-[14px]" />
          </div>
        ) : !hasData(data) ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="text-[15px] font-semibold">No agent activity yet</p>
            <p className="mt-1 text-[13.5px] text-muted">Ask Kart, or a connected agent like Claude Desktop, to buy something. Every request, decision and PayPal payment shows up here.</p>
          </div>
        ) : (
          <AgStudioProvider licenseKey={licenseKey} modules={ai ? [AgStudioAiModule] : undefined}>
            <AgStudio
              style={{ height: "100%", width: "100%" }}
              theme={kartStudioTheme}
              // Fit the canvas to the window: no inner horizontal scrolling on laptop screens.
              layout={{ widgetBorderEnabled: true, minWidth: 560 }}
              data={studioData}
              context={context}
              widgets={(config) =>
                createWidgets({
                  additionalTypes: [guardrailWidget],
                  menu: [...config.menu, { label: "Kart", widgetIds: ["kart-guardrail"] }],
                } as never)
              }
              ai={ai}
              initialState={{ ...initialState, selectedPageId: page }}
              mode={mode}
              panels={{ edit: { left: ["ai"], right: ["filters", "edit", "data"] }, view: { right: ["filters"] } }}
              onApiReady={(e) => {
                apiRef.current = e.api;
              }}
              onStateUpdated={(e) => {
                if (e.state.selectedPageId && e.state.selectedPageId !== page && PAGES.some((p) => p.id === e.state.selectedPageId)) setPage(e.state.selectedPageId);
              }}
            />
          </AgStudioProvider>
        )}
      </div>
    </div>
  );
}
