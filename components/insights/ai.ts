// The AI assistant inside the insights dashboard, built on AG Studio's Agent Framework.
//
// Primary agent: "Kart", a custom agent that knows the shopper's spending rules and Kart's safety model.
// It answers money questions itself (reading the rules and querying the data), and hands any change to
// the dashboard to Studio's built-in "lead" agent, which coordinates Studio's own data, page and widget
// agents. Every agent runs on Claude through ./claudeAdapter. The assistant can explain and suggest,
// but it has no tool that changes a rule: only the shopper can, in Kart.
import { createAiHarness, directLlmRunner, type AgAiHarnessSetup, type AgAiPromptStarter, type AgAnyAiAgentDefinition, type AgStudioApi } from "ag-studio";
import { claudeAdapter } from "./claudeAdapter";

const STARTERS: AgAiPromptStarter[] = [
  { label: "Am I on track this month?", prompt: "How much have my agents spent this month, how much is left under my cap, and is anything unusual?" },
  { label: "Why was something blocked?", prompt: "List every purchase Kart stopped, which rule stopped it, and whether my rules look right." },
  { label: "Which agent spends most?", prompt: "Compare Kart chat and my connected agents: what each asked for and what Kart did. Add a chart for it." },
  { label: "Where did I save?", prompt: "How much did comparing stores save me, and on which orders? Add a widget that shows it." },
];

const KART_INSTRUCTIONS = `You are Kart's spending analyst inside the shopper's insights dashboard.
Kart lets AI agents (Kart's own chat, and connected agents such as Claude Desktop or ChatGPT) buy things with the shopper's PayPal, but only inside the shopper's rules:
- Under the auto-buy limit, Kart pays on its own with saved PayPal.
- Above it and up to the max per item, the shopper must confirm.
- Over the max per item, or over the monthly cap, Kart blocks it. No money moves.
- Right before PayPal charges, Kart re-checks the live price on Channel3 and buys from the cheapest store in stock. If the price went up, it stops.
- The Kart Guarantee pays the shopper back first for damaged, lost or price-dropped items.

How to work:
- For questions about money, agents, decisions or rules: call get_spending_rules when limits matter, look at the schema, and run queries. Answer with exact numbers in plain, short sentences.
- To add, change or remove anything on the dashboard (widgets, charts, filters, pages), delegate to the "lead" agent with a clear instruction. Do not edit the dashboard yourself.
- You cannot change the shopper's rules. If a rule looks too loose or too tight, say what you'd change and tell them to update it in Kart under Spending rules.
- Never invent orders, stores or amounts. If the data doesn't show it, say so.`;

type RulesCtx = { rules: { autoBuyUnder: number; perItemMax: number; monthlyCap: number; maxOrdersPerHour?: number; mandateActive?: boolean }; monthSpent: number };

function rulesTool(api: AgStudioApi, getCtx: () => RulesCtx | null) {
  return api.defineAiTool({
    name: "get_spending_rules",
    description: "The shopper's current Kart spending rules and this month's spend: auto-buy limit, max per item, monthly cap, amount spent and left, orders-per-hour limit, and whether PayPal is saved for one-tap.",
    params: (s) => s.object({}),
    execute: () => {
      const c = getCtx();
      if (!c) return { success: false, issues: [{ message: "Rules are not loaded yet." }] };
      const { rules, monthSpent } = c;
      return {
        success: true,
        response: JSON.stringify({
          buys_on_its_own_up_to: rules.autoBuyUnder,
          asks_you_up_to: rules.perItemMax,
          never_more_than_per_item: rules.perItemMax,
          monthly_cap: rules.monthlyCap,
          spent_this_month: monthSpent,
          left_this_month: Math.max(0, Math.round((rules.monthlyCap - monthSpent) * 100) / 100),
          max_orders_per_hour: rules.maxOrdersPerHour ?? 5,
          paypal_saved_for_one_tap: !!rules.mandateActive,
        }),
      };
    },
  });
}

export function buildKartAi(getCtx: () => RulesCtx | null): AgAiHarnessSetup {
  const adapter = claudeAdapter();
  return ({ api }) =>
    createAiHarness(api, ({ builtIn }) => {
      const onClaude = (def: AgAnyAiAgentDefinition) => directLlmRunner({ ...def, adapter });
      const kart = directLlmRunner({
        id: "kart",
        name: "Kart",
        description: "Answers questions about the shopper's spending, agents, decisions and rules, and asks the lead agent to change the dashboard.",
        adapter,
        maxTurns: 14,
        instructions: () => KART_INSTRUCTIONS,
        tools: (ctx) => [rulesTool(ctx.api, getCtx), ctx.studio.viewSchema(), ctx.studio.viewPage(), ctx.studio.executeQuery(), ctx.tools.delegateTo(["lead"]), ctx.tools.renameThread()],
      });
      return {
        agents: [kart, onClaude(builtIn.lead), onClaude(builtIn.data), onClaude(builtIn.page), onClaude(builtIn.planning), onClaude(builtIn.widget)],
        primary: "kart",
        promptStarters: STARTERS,
      };
    });
}
