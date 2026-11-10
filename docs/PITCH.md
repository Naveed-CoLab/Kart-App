# Kart: the trust layer for AI agents that spend money

> Any AI agent can shop for you through Kart. Your rules decide what gets paid. PayPal moves the money. The Kart Guarantee pays you back first if something goes wrong.

**PayPal AI Hackathon 2026** · Built with PayPal, Claude (Anthropic) and Channel3

---

## 1. The problem

AI agents can now browse, compare and check out. Letting one actually spend your money is still a leap of faith:

- **No limits.** Most agents either can't buy at all or can buy anything. There is nothing in between.
- **No control across agents.** You might use Claude, ChatGPT and Cursor. Each would need its own payment setup, with its own risks.
- **Wrong price.** Agents buy from the first store they find, at a price that may have changed since they searched.
- **No recourse.** If an agent buys the wrong item, or the parcel arrives damaged, you are on your own with a dispute form.
- **No visibility.** Nobody can see, in one place, what their agents asked for, what was bought and why.

People won't hand their wallet to an agent until there are clear rules before the purchase and protection after it.

## 2. The solution

Kart sits between any AI agent and the shopper's PayPal account.

| Before the purchase | During the purchase | After the purchase |
|---|---|---|
| **Your rules.** Kart buys on its own up to your auto-buy limit and asks first above it. It never goes over your max per item, your monthly cap or your orders-per-hour limit. | **PayPal.** The shopper's PayPal pays the store directly. Kart never holds the money, and agents never see PayPal logins or cards. | **Kart Guarantee.** Damaged, lost or cheaper later? Kart pays the shopper back first through PayPal Payouts or a refund, then recovers the money from the store. |

**The right price, checked twice.** Channel3 shows every store selling the exact same product, and Kart buys from the cheapest one in stock. Right before PayPal charges, Kart checks the live price again on Channel3. If it went up, the agent stops; if it went down, you pay less.

**See everything your agents did.** The Insights dashboard (AG Studio) shows every request, decision, payment and payback, and Claude answers questions about it.

**One set of rules covers every agent, and each agent gets less.** Kart is an MCP server, so Claude Desktop, Claude.ai, ChatGPT, Cursor or any other MCP client can shop through it. Each agent gets its own key with its own permissions, on top of the shopper's rules:

- **Can buy, or search only.** A research agent can look but never pay.
- **Pays on its own: off by default.** A new agent's purchases wait for the shopper's OK until the shopper says otherwise.
- **Its own monthly budget** (never above the shopper's cap), shown as a spend bar per agent.
- **Keys expire** (7, 30 or 90 days), can be renewed, and one tap disconnects one agent or all of them.

**See where your money can go, at a glance.** The Rule Lane is one bar with three zones: green (Kart pays on its own), amber (Kart asks you first) and red (never). Every price is a pin on that lane: on the home screen as this month's purchases, on every approval card, on every order, and on the "Stopped by your rules" card, which ends with "No money moved".

**Watch it work.** While Kart acts, the chat shows each step as it happens: "Found 12 products", "Re-checked the live price on Channel3", "Checked your rules", "Charged PayPal", "Paid the store". Nothing in that trace is invented. Each step is an event Kart actually logged, so the trace and the decision trail always match.

## 3. How it works

```
Shopper ──▶ any AI agent (Claude, ChatGPT, Cursor…) ──MCP──▶ Kart
                                                        │
                       search_products (Channel3) ◀─────┤
                       buy_product ─▶ Kart's rules ─────┤
                         └─ live price + stock re-checked on Channel3 (cheapest store)
                         ├─ under the auto-buy limit ─▶ PayPal pays the store ─▶ "bought"
                         ├─ above it ─▶ shopper confirms in Kart ─▶ "waiting_for_you"
                         └─ over the max or the cap ─▶ "blocked", no money moves
                                                        │
              Store dashboard: ships, adds tracking ◀───┤
              Kart Guarantee: Payouts / Refunds ◀───────┘
```

**The same request, three outcomes:**

| The agent asks to buy… | Kart's answer | Why |
|---|---|---|
| $12 running socks | **Bought** with saved PayPal (can be cancelled within 10 minutes) | Under the $30 auto-buy limit |
| $44.99 earbuds | **Waiting for you**, with a confirm link | Over $30, so the shopper decides |
| $89 shoes | **Blocked**, no money moved | Over the $50 max per item |

On screen, each of these is a pin on the Rule Lane: green, amber or red.

## 4. Two sides of the market

**Shoppers** get:

- A Kart chat agent, or the AI agent they already use
- Spending rules
- One-tap PayPal checkout
- Orders, tracking and money paid back, all in one place

**Stores** get:

- Orders that arrive already paid
- A dashboard to ship orders and add tracking (which syncs to the PayPal transaction)
- A way to settle claims
- A two-step onboarding:

    1. Prove they own the domain with a DNS TXT record or a file on their site.
    2. Connect PayPal with Partner Referrals or a business email.

After that, orders are paid straight into the store's own PayPal account.

## 5. PayPal is the core, not an add-on

| PayPal API | What Kart uses it for |
|---|---|
| Orders v2 + JS SDK buttons | Checkout, paying the store as the payee |
| Vault (saved PayPal) | One-tap and auto-buy within the shopper's rules |
| Payouts | The Kart Guarantee: paying the shopper back first |
| Refunds | Returns and price-drop credits |
| Partner Referrals | Stores connecting their PayPal business account |
| Tracking | The store's tracking added to the PayPal transaction |
| Webhooks | Keeping order state in sync |
| Agent Toolkit | Giving the agent PayPal actions |

All of this runs in the PayPal sandbox, so judges can see each payment, payout and refund in the sandbox accounts.

## 6. AI usage

- **Claude** runs the shopping agent. It understands the request, searches, compares, explains its picks and calls tools.
- **The MCP server** lets agents from other companies shop through the same rules (agent-to-agent commerce).
- **Channel3** provides real products from thousands of stores, every store's price for the same product, live re-checks before payment, and photo search.
- **AG Studio + Claude** power the Insights dashboard: a custom Kart agent (AG Studio Agent Framework) answers questions about spending and rules, and hands dashboard changes to Studio's own agents.
- **A decision trail** logs every action, whether by Kart's own agent or a connected agent, with the agent's name. Each entry records the rule that was applied, so the shopper can see why each purchase did or didn't happen. The live trace in the chat is built from the same events.
- **Claude vision** checks damage-claim photos against the product before the Guarantee pays out, and a risk score sends doubtful claims to the store for review.

## 7. Why Kart is different

- **Rules live outside the AI.** The spending limits are enforced in code on Kart's side, so no prompt can talk an agent past them.
- **Protection after checkout.** Most agent-shopping demos stop at "paid". Kart covers what happens next, with a PayPal-backed refund-first guarantee.
- **Works with any agent.** Kart is not another chatbot to switch to. It is the trust layer behind the agent the shopper already uses.
- **Never a stale price.** Kart compares every store and re-checks the live price on Channel3 right before PayPal charges.
- **Built for both sides.** Stores get verified onboarding and paid orders, which gives them a reason to join.
- **Least privilege for agents.** Every connected agent gets a smaller box than the shopper: its own budget, expiry and permission to pay on its own (off by default).

## 7b. Built to be trusted with money

Kart moves real money in the PayPal sandbox, so it is built like a payments app, not a demo:

- **Money decisions happen on the server.** Prices come from Channel3, never from the browser or the agent. Confirming a purchase issues a signed, single-use, 10-minute token bound to that product and exact price. The AI has no tool that can create one.
- **Price lock.** If the live price went up after the shopper saw it, Kart refuses to charge.
- **Agent keys.** 192-bit random keys; only a SHA-256 hash is stored, and the key is shown once. Per-key and per-IP rate limits, request size caps, and budgets checked before every purchase.
- **Sessions and requests.** Signed sessions that expire; a cross-site request check on every change; strict input checks (a malformed or out-of-range spending limit is rejected, never stored); security headers (no framing, no sniffing, HSTS).
- **Webhooks and stores.** PayPal webhooks are accepted only with a verified signature. Store ownership is proven by DNS or a file on the site, with protection against requests into private networks. A store can only see and act on its own orders.
- **Private data stays private.** Each shopper's data is separate. Claim and chat photos open only for the shopper who added them. PayPal tokens and the shopper's email never reach the browser or a store.
- **Nothing disappears.** Every order, chat, rule, agent key and photo is stored in Postgres (Neon) and written before each response returns. If a write fails, the shopper sees an error instead of a false success.

## 8. Fit with the judging criteria

| Criterion | What Kart shows |
|---|---|
| Technological implementation | 8 PayPal APIs, an MCP server built to the spec with per-agent permissions, Channel3 offers + live re-check + image search, an AG Studio dashboard with a Claude adapter and a custom agent, per-user data and photos in Neon Postgres, Clerk sign-in, store verification, a full security pass |
| Design | One signature visual (the Rule Lane) used everywhere money is decided, a live step-by-step trace while Kart works, a chat app with history, pinning and search, and separate shopper and store apps |
| Potential impact | Removes the trust barrier that stops people letting agents spend money, and gives stores a way to receive agent orders |
| Innovation | A rules layer that works with any agent, plus a refund-first guarantee |
| Presentation | One clear story: rules before, PayPal during, guarantee after |

**Hackathon themes Kart covers:** AI Agents & Automation (an agent that shops and pays within rules, and an MCP server for other agents), Money Movement (Orders, Vault, Payouts, Refunds), Consumer (spending protection and a refund-first guarantee) and Business Solutions (paid, verified orders for stores).


## 8b. Sponsor fit

| Sponsor | What Kart uses | Why it isn't bolted on |
|---|---|---|
| **Channel3** | `/v1/search` (agentic mode), `/v1/products/{id}` live re-check, `/v1/image-search`, every store's offer, `x-user-id` attribution, commission rates | It's how Kart finds the right price and makes sure an agent never pays a stale one. |
| **AG Grid (AG Studio)** | AG Studio dashboard (KPIs, charts, grids), a custom "Kart guardrail" widget, Kart theme, saved layouts, AI on the Studio Agent Framework with a custom Kart agent delegating to Studio's built-in agents, running on Claude via a custom adapter | Oversight is part of Kart's promise: shoppers need to see what their agents did with their money, and ask about it. |

## 9. Scope today, and what's next

**Today:** Kart pays stores through PayPal (the store as payee, or Kart's sandbox merchant paying the store with Payouts), and the store fulfils from its dashboard. Channel3 provides the products, every store's price and live re-checks; its checkout API is announced but not yet available, so Kart doesn't place orders inside other stores' websites.

**Next:**

- Placing the order at the cheapest store automatically through Channel3 checkout, once it's available
- A "Pay Later above $X" rule using PayPal Pay Later
- Connecting to PayPal's own remote MCP server
- Spending categories per agent (for example, a work agent that can only buy office supplies)
- Store-side APIs, so stores can publish their catalogs and returns policies directly to agents

## Try it

1. Open Kart, then choose **Try the demo without an account**.
2. Shop in the chat, or go to **Connected agents** and connect Claude Desktop.
3. Choose **Switch to the store side**, then **Open the demo store**, to see the same orders as the store.

The [README](../README.md) has the full judge walkthrough.
