# Kart

**An AI shopping agent you can trust with your money.** Kart finds the best product across thousands of stores, buys it within rules you set, pays the store with PayPal, and backs every order with the **Kart Guarantee**: if anything goes wrong, Kart pays you back instantly and deals with the store itself.

> PayPal AI Hackathon 2026 entry · Built with Claude, PayPal (Orders, Vault, Payouts, Refunds, JS SDK, Agent Toolkit), Channel3, Next.js and Render.

## The problem

AI agents can already shop (Perplexity, Copilot, Google, Meta Muse), but they pay the store and leave you to chase refunds. **52% of shoppers aren't comfortable letting an agent buy for them**; their top fear is losing control (42%). **Spending limits (28%)** and **easy refunds (30%)** would change their mind (Checkout.com, Dec 2025).

## What Kart does

| | |
|---|---|
| **Finds** | Searches thousands of real stores through **Channel3** and recommends 3 options with reasons grounded in real ratings, features and prices |
| **One-tap ordering** | Like Muse or Grok: connect PayPal once, then every order is a confirmation card. Tap **Confirm & pay** and Kart pays with your saved PayPal (vault), no popup. Small items under your auto-buy limit can be bought on their own |
| **Buys within your rules** | Auto-buy limit, ask-first limit, per-item max, monthly cap and max orders per hour, all enforced on the server, so the AI can't bypass them |
| **Pays the store with PayPal** | The shopper's PayPal pays the **store directly** (Orders v2 `payee`). Kart never holds the money. PayPal and **Pay Later** buttons sit right in the chat |
| **Kart Guarantee** | Damaged item: photo → Claude vision + fraud score → **paid back in seconds**. Lost package, **price drop within 30 days**, or undoing an auto-buy: paid back instantly via **PayPal Payouts**. Kart then recovers the money from the store; the shopper never chases anyone |
| **Store side** | Merchant portal: orders from AI shoppers, mark shipped (tracking goes to PayPal via the **Agent Toolkit**), fees, returns |
| **Explains itself** | A decision trail shows every search, decision, rule, payment, refund and webhook |

## Any AI agent can shop through Kart (MCP)

Kart is also an MCP server, so Claude Desktop, Claude.ai, ChatGPT, Cursor or any other MCP client can shop for you, and Kart's rules still decide what gets paid. In the app, open **Connected agents**, pick an agent and click **Create key**. Each agent gets its own key, which you can disconnect at any time.

| Tool | What it does |
|---|---|
| `search_products` | Searches real stores through Channel3. Results never go over your max price per item. |
| `get_my_rules` | Returns your auto-buy limit, max per item, monthly cap and how much you've spent. |
| `buy_product` | Applies your rules. Under the auto-buy limit it pays with your saved PayPal and returns `bought`. Above it, it returns `waiting_for_you` with a link so you confirm in Kart. Over the max or the cap it returns `blocked`. |
| `check_purchase` | Checks whether you confirmed and paid a request that was waiting for you. |
| `list_orders` | Lists your orders with tracking and any money paid back. |

An agent can't approve a purchase for you, can't go over your limits, and never sees your PayPal details. Every request appears as a chat in Kart and in your decision trail.

**Claude Desktop:** paste the config shown on the Connected agents page into `claude_desktop_config.json` (it uses `npx mcp-remote <your Kart link>`), then restart Claude. Try asking: "Find me running socks under $20 and buy the best one with Kart."

**Claude.ai / ChatGPT:** add your Kart link as a custom connector. These apps connect from the internet, so they need the deployed URL: set `APP_URL` to your Render URL.

The endpoint is `POST /api/mcp/<key>`, or `POST /api/mcp` with `Authorization: Bearer <key>`. It uses MCP streamable HTTP in stateless JSON mode.

## Channel3: the whole market, checked twice

AI agents overpay. They buy from the first store they find, at a price that may already be stale. Kart uses Channel3 to fix that:

- **Every store for the same product.** Channel3 returns every store selling the exact product (`offers[]`). Kart buys from the cheapest one in stock, and the product card shows "Cheapest of N stores · saves $X".
- **A live check right before PayPal charges.** Kart fetches the product again (`GET /v1/products/{id}`) before every payment: PayPal checkout, one-tap, auto-buy and MCP agents. If the price went up, Kart stops and asks again, and nothing is charged. If it went down, or another store is now cheaper, the shopper pays less. If it's out of stock everywhere, Kart stops. Each check goes in the decision trail.
- **Search by photo.** `POST /v1/image-search`: "find me these" with a photo.
- **Attribution.** Kart sends `x-user-id`, so Channel3 reporting credits sales to each shopper, and shows the commission disclosure when a brand pays one.

## Insights: what your agents did with your money (AG Studio)

**Insights** in the shopper app is an AG Studio dashboard built from Kart's own data:

- **Spending page:** net spent, orders, saved by comparing stores, money paid back by the Kart Guarantee, spend by store, how PayPal was used (checkout, one-tap, auto-buy), and every order with its PayPal transaction.
- **Agent decisions page:** what each agent (Kart chat, Claude Desktop, ChatGPT…) asked for and what Kart did (bought on its own, bought after your OK, blocked, stopped by the live check), which rule decided, and the full decision trail.
- **A custom widget, "Kart guardrail":** this month's spend against the cap, the auto-buy / ask / never bands, and how often the rules stopped an agent. It's available in the widget menu under "Kart".
- **Kart's theme:** fonts, colours and cards match the app. Shoppers can **Customize** the layout and save it.
- **AI on Claude (AG Studio Agent Framework):** a custom **Kart** agent is the primary agent. It knows the spending rules (tool `get_spending_rules`), queries the data, and delegates dashboard changes to Studio's built-in lead agent, which works with Studio's data, page and widget agents. All agents run on Claude through a Claude adapter (`components/insights/claudeAdapter.ts` → `/api/ai/studio`), so the key stays on the server. The assistant can explain and suggest, but it has no tool that changes a rule.

Optional: set `AG_STUDIO_LICENSE_KEY` in `.env.local` (45-day trial from ag-grid.com) to remove the trial watermark.

## Security

- **Sessions:** HMAC-signed, httpOnly, SameSite=Lax, Secure in production, and they expire after 30 days on the server too. In production Kart refuses to sign with a default secret: set `APPROVAL_SECRET` (32+ random characters).
- **Cross-site requests:** every API call that changes something must come from Kart's own pages. PayPal webhooks and MCP agents are exempt; they prove themselves with a PayPal signature or an agent key.
- **Connected agents (least privilege):** each agent has its own key (192-bit, only a hash is stored, shown once), its own monthly budget, an expiry date, and is either read-only, "asks before every buy" (the default), or "can pay on its own". The shopper's rules still apply on top. Agents never see PayPal details. "Disconnect" and "Disconnect all" take effect immediately. Claude Desktop sends the key in a header, never in a URL.
- **Rate limits:** chat, the Insights AI, MCP (per key and per IP), agent purchases, demo sign-ups and store verification.
- **Input limits:** message, photo, MCP request and batch sizes are capped; uploaded photos must really be images (checked by their bytes) and are only shown to signed-in users.
- **PayPal webhooks:** only events with a valid PayPal signature are accepted.
- **Store verification:** Kart only fetches public websites (no IP addresses, internal names or redirects).
- **Errors and headers:** internal errors never reach the browser; responses send `X-Frame-Options`, `nosniff`, a strict referrer policy and HSTS in production.

## Two sides: shopper app and store dashboard

| | Who | What they see |
|---|---|---|
| `/` | Everyone | What Kart is: problem, how it works, money flow, safety, PayPal APIs |
| `/login` | Everyone | Sign in as the shopper, or as a store (by store domain) |
| `/shop`, `/chat/…`, `/orders` | Shopper | Chat with the agent, confirm orders, spending rules, orders and refunds |
| `/store` | Store | Only that store's orders: ship with tracking, approve claims, settle returns, fees |

Sessions are signed (HMAC) httpOnly cookies, and every API route checks the role on the server: a shopper can't ship orders, a store can't pay, and a store can't see or touch another store's orders. Shoppers can sign in with **Clerk** (email or Google, embedded on `/login`) when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set; the Clerk user becomes a signed Kart session (`/api/session/clerk`). A one-click demo sign-in stays available so judges don't need accounts. In production it would be PayPal Log In for shoppers and verified PayPal business accounts for stores.

## Storage

With `DATABASE_URL` set, Kart stores everything in **Postgres**: one row per order, event, claim, chat, product, agent key and the shopper's rules (`kart_data`, JSONB, per shopper), plus chat and claim photos (`kart_files`). Data is loaded at startup and written before each API response returns; if a write fails, the request returns an error instead of a false success, and the change is retried with the next one. Nothing is lost on restart or redeploy.

Without `DATABASE_URL`, Kart saves to local JSON files in `.data/`, which is fine on your own computer. The first time Kart starts with a database, it **imports everything from `.data/` automatically**, so switching loses nothing. Older saved data is upgraded in place, never dropped. `/api/status` shows which storage is active (`"db": "postgres"` or `"local files"`). Render's free Postgres expires after 30 days, so for judging (until Dec 15) a free [Neon](https://neon.tech) database is the safer choice.

## Store checkout (demo in sandbox)

After PayPal pays, Kart's checkout agent places the order on the store's website: opens checkout, adds the item, enters your PayPal shipping address, pays with PayPal and gets a store order number. **In sandbox this step is a demo** (marked "Sandbox demo" in the app), because sandbox money can't buy real goods. Search, spending rules, the PayPal sandbox payment, tracking and the Kart Guarantee are real. Live, this step uses the store's checkout API (Shopify/Channel3 checkout or PayPal Agent Ready); set `STORE_CHECKOUT=live` once it's connected. The code is in `lib/storeCheckout.ts`.

## How the money moves (sandbox)

```
Shopper PayPal ──Orders v2 (payee = store)──▶ Store          (store paid immediately)
     ▲
     └── Kart Guarantee ◀── PayPal Payouts from Kart  (damage / lost / price drop / undo)
                            then Kart recovers from the store (return or PayPal dispute)
```

If PayPal won't route a payment straight to the store (for example a vault charge), Kart captures it and **pays the store instantly via Payouts**, so the store is always paid right away.

In production, stores join through PayPal's merchant programs (Agent Ready / marketplace onboarding), and big stores are reached through checkout APIs. Kart earns a 5% fee from partner stores plus affiliate commission (Channel3) from big stores; that funds the guarantee, alongside recovery from stores and insurance.

## PayPal usage map

| PayPal capability | Where |
|---|---|
| OAuth2 client credentials | `lib/paypal.ts` → `accessToken()` |
| Orders v2 with `payee` (pay the store directly) + capture | `lib/paypal.ts` → `createOrder`, `captureOrder`; routes `app/api/paypal/create-order`, `capture-order` |
| Vault: save PayPal during purchase (`store_in_vault: ON_SUCCESS`) | `lib/paypal.ts` → `createOrder({ saveToVault })` |
| Vault: payment with `vault_id` (Agent Mandate auto-buy) | `lib/paypal.ts` → `chargeVault`; `lib/orders.ts` → `autoBuy` |
| Payouts: Kart Guarantee money-back, and instant store payment fallback | `lib/paypal.ts` → `createPayout`; `lib/orders.ts` → `guaranteeCredit`, `settleStore` |
| Refunds (when Kart captured the payment) | `lib/toolkit.ts` → `refund` (Agent Toolkit `create_refund`, REST fallback) |
| **Agent Toolkit**: `create_shipment_tracking`, `update_shipment_tracking` | `lib/toolkit.ts`; `app/api/paypal/ship` |
| **Agent Toolkit**: read tools for Claude (`get_order`, `get_shipment_tracking`) | `lib/agent.ts` → `get_order_status` tool |
| JS SDK: PayPal + Pay Later buttons, Pay Later messages | `components/ChatCards.tsx`, `components/PayPalProvider.tsx` |
| Webhooks + signature verification | `app/api/paypal/webhook/route.ts` |

## Safety (one-tap orders)

Claude can never call a money-moving PayPal tool. It calls `request_purchase`, which only shows a card. Money moves only after the shopper taps **Confirm & pay** (`app/api/confirm-order`), and the server checks all of this first:

| Check | What it stops |
|---|---|
| Signed, single-use confirmation (HMAC, 10 minutes) bound to the product and exact price | Replayed or forged confirmations; the AI confirming for you |
| **Price lock**: live re-price on Channel3 before charging; refuses if the price went up | Paying more than you saw |
| Spending rules: per-item max, monthly cap | Big or runaway spending |
| **Max orders per hour** (default 5) | A looping agent or a stolen session |
| Duplicate (same item in 24h) and first-order-from-store warnings: a second tap is needed | Accidental double orders, unfamiliar stores |
| Same-origin check on every money route | Cross-site form posts |
| Vault token never sent to the browser | Token theft |
| **Cancel free for 10 minutes**, then the Kart Guarantee | Mistakes after paying |
| Revoke the saved PayPal anytime in Spending rules | Lost trust |

## AI usage

- **Claude** (Anthropic API, tool use) runs the agent loop in `lib/agent.ts`. Tools: `search_products`, `recommend_products`, `check_budget`, `request_purchase`, `get_orders`, `get_order_status`, `start_claim`, `create_watch`.
- **Claude vision** inspects damage photos against the product (`lib/vision.ts`). The result feeds the fraud score (`lib/fraud.ts`): below 0.30 means Kart pays back automatically, otherwise the claim goes to review.
- **Channel3** agentic product search (`lib/channel3.ts`), normalized and cached for 24 hours.

## Run it locally (Windows / macOS / Linux)

Requires Node 20+.

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
# fill in the keys (see below)
npm run dev
# open http://localhost:3000
```

Kart has no demo or sample data: every product, order and payment is real (PayPal sandbox). If a key is missing, a yellow "Finish setup" bar at the top tells you which one.

### PayPal sandbox setup (one time)

1. Go to developer.paypal.com → **Testing tools → Sandbox accounts** and create:
   - **Shopper**: a Personal account, US. You log in with it in the PayPal popup.
   - **Kart**: a Business account. Your app's credentials belong to it.
   - **Store**: a Business account. Put its email in `STORE_PAYPAL_EMAIL`. Shoppers' payments go straight to it.
2. Under **Apps & Credentials → your sandbox app → Features**, turn on:
   - **Payouts** (Kart Guarantee money-back)
   - **Save payment methods** (Vault). This powers the Agent Mandate.

   Also put the Shopper account's email in `SHOPPER_PAYPAL_EMAIL` (fallback receiver for money-back).
3. Copy the Client ID and Secret into `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`.
4. After deploying, add a webhook in the app pointing to `https://YOUR-APP/api/paypal/webhook` for these events, then put its ID in `PAYPAL_WEBHOOK_ID`:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.PAYOUTSBATCH.SUCCESS`
   - `VAULT.PAYMENT-TOKEN.CREATED`

If Vault isn't available on the app, checkout still works: Kart falls back to a normal order, and the auto-buy tier shows a one-tap PayPal button instead.

## Deploy to Render

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, and pick the repo. `render.yaml` sets the build and start commands.
3. Fill in the secret env vars, and set `APP_URL` to the Render URL.

Set `DATABASE_URL` (Postgres) so orders survive restarts; Render's free disk is wiped on every restart.

## Walkthrough

0. Open `/`, read what Kart is, click **Try Kart as a shopper** (one-click sign-in).
1. Open **Spending rules**: auto-buy up to $30, ask up to $50.
2. Type "Wireless earbuds for the gym under $50". You get 3 real Channel3 picks with photos.
3. Buy one: the first time, pay with your sandbox Shopper account in the PayPal popup (keep "Save PayPal for one-tap orders" on). The store is paid immediately.
4. Type "Buy me a phone case under $40". Kart shows a confirmation card (item, total, saved PayPal, ship-to). Tap **Confirm & pay**: paid with no popup. Cancel within 10 minutes if you change your mind.
5. Type "Buy me athletic socks under $20". Under the auto-buy limit, Kart buys them on its own (Undo for 10 minutes).
6. **Switch to the store side** (sidebar), sign in as the store from step 3, and in the **store dashboard** click **Mark shipped**, enter the carrier and tracking number. Tracking is added to the PayPal transaction via the Agent Toolkit.
7. **Order page** (shopper side): **Check for a lower price** re-prices it on Channel3 (Price Guard pays any drop), **It arrived** confirms delivery, **It never arrived** pays you back for a lost package.
8. In chat, attach a photo and type "The earbuds arrived broken". Claude vision checks it and Kart pays you back instantly.
9. **Store dashboard**: approve claims in review and **Settle** money Kart paid back. On the shopper side, **My orders & spending** shows the KPIs, charts, payments and decision trail.

## For judges: check the whole flow

Everything runs on the **PayPal sandbox**, so no real money moves. Every step can be checked inside PayPal itself.

**1. Shopper side** (`/login` → I'm shopping → *Try the demo without an account*, or sign in with Clerk)
- Ask for something ("wireless earbuds under $50"). Kart searches Channel3 and recommends 3.
- Pay with the PayPal button. Log in with the **sandbox shopper account** below. Keep "Save PayPal for one-tap orders" on.
- Buy something else: a confirmation card appears and **Confirm & pay** charges the saved PayPal with no pop-up.
- Each order page shows the **PayPal transaction ID** and a link to the sandbox account.

**2. Store side** (`/login` → I'm a store → **Open the demo store**, in the same browser)
- The demo store shows the orders you just placed. Click **Mark shipped** and add a tracking number (it is added to the PayPal transaction through the Agent Toolkit).
- Approve claims and **Settle** money Kart paid back to the shopper.

**3. Check it in PayPal** (sandbox.paypal.com)

| Log in as | You should see |
|---|---|
| Sandbox **shopper** (Personal) | The payment for each order; Kart Guarantee money back (price drop, lost or damaged item) as incoming payouts or refunds |
| Sandbox **store** (Business) | Each order paid straight in, with tracking added after "Mark shipped" |
| Sandbox **Kart** (Business, owns the app) | Payouts sent for the Kart Guarantee |

Sandbox logins for judges (fill in before submitting):
- Shopper (Personal): `sb-…@personal.example.com` / `…`
- Store (Business): `sb-…@business.example.com` / `…`

### How real stores join
A store owner signs in, claims their domain, and **proves they own it** with a DNS TXT record or a file at `/.well-known/kart-verification.txt`. Then they connect PayPal, either through **PayPal partner sign-up** ("Connect with PayPal", which needs partner access on the PayPal app) or by entering their **PayPal business email**. From then on, that store's orders are paid straight into its own PayPal account. Stores that haven't joined are paid through Kart's sandbox store account (`STORE_PAYPAL_EMAIL`). Nobody can open a store's dashboard without owning its domain.

## Tech

Next.js 15 (App Router, TypeScript, Tailwind v4) · [Wedges](https://www.lemonsqueezy.com/wedges) UI components (Button, Badge, Switch, Select, Tooltip, Avatar, Kbd; loaded through a small Tailwind v4 compatibility shim in `tailwind.config.mjs`) · `simple-icons` brand marks · `@anthropic-ai/sdk` · `@paypal/agent-toolkit` · `@paypal/react-paypal-js` · Channel3 API · Recharts · Lucide. Storage: Postgres (`pg`) or a local JSON file.

## License

Kart's source code is released under the [MIT License](LICENSE). Copyright (c) 2026 Naveed Ahmed.

Third-party parts keep their own terms:

- **Dependencies** (Next.js, React, the Anthropic SDK, the PayPal SDKs and Agent Toolkit, Clerk, `pg` and others) are installed from npm under their own licenses.
- **AG Studio / AG Grid:** `ag-grid-community` is MIT. `ag-studio` is a commercial AG Grid product; it runs with a trial watermark unless you set your own `AG_STUDIO_LICENSE_KEY`.
- **PayPal brand assets** in `public/brand/` belong to PayPal and are used under PayPal's brand guidelines. They are not covered by the MIT License.
- **Channel3, Claude and PayPal APIs** are used under their providers' terms. Bring your own keys (see `.env.example`).
