# Kart demo video: script and shot list

**Length:** 2:50 (stay under 3:00). **Format:** screen recording at 1080p with a voice-over, browser at 100% zoom, no bookmarks bar.

**Story in one line:** rules before the purchase, PayPal during it, the Guarantee after it, for any AI agent.

---

## Before you record (10 minutes)

1. Start Kart (`npm run dev`) with all keys and `DATABASE_URL` set. Open the app and check that no red "Issue" badge shows at the bottom left. If one shows, record on a production build (`npm run build && npm start`), which never shows it.
2. Sign in as the shopper. Set the rules to **auto-buy up to $30, max $50 per item, $200 a month**.
3. Save PayPal for one-tap once before recording (make one confirmed purchase with "Save PayPal for one-tap" on), so the auto-buy works on camera.
4. In **Connected agents**, connect **Claude Desktop** and turn on "Can pay on its own" for it, with a $50 budget. Restart Claude Desktop and check that it lists the Kart tools.
5. Open these tabs in order:
   1. Kart home (`/shop`)
   2. Claude Desktop (a separate window)
   3. Kart **Connected agents**
   4. Kart **store side** (demo store)
   5. Kart **Insights**
   6. PayPal sandbox: buyer account activity
   7. PayPal sandbox: business account activity
6. Have a "damaged item" photo ready on the desktop (for example, a photo of cracked earbuds).
7. Do one dry run of every prompt below. Channel3 prices change, so pick products that land clearly in each zone.

---

## Shot list

| Time | On screen | What you do | Voice-over |
|---|---|---|---|
| **0:00–0:12** | Kart landing page, headline "Shop with an agent that can't overspend" | Slow scroll | "AI agents can find things and check out now. But would you hand one your wallet? No limits, no recourse, no idea what it bought." |
| **0:12–0:27** | Kart home: **"Where your money can go"** lane | Hover over the green, amber and red zones and the purchase pins | "Kart fixes that. You set your rules once: under $30 Kart pays on its own, up to $50 it asks you, and above that it never pays. Every purchase lands somewhere on this lane." |
| **0:27–0:55** | Kart chat | Type: **"Buy me athletic crew socks under $20"**. Let the trace run: *Found N products → Picked the best option → Re-checked the live price on Channel3 → Checked your rules → Charged PayPal → Paid the store.* | "Watch it work. Kart searches thousands of stores through Channel3, picks the cheapest store selling the exact item, re-checks the live price right before paying, checks my rules, and pays the store straight from my PayPal. Every step here is a real event, not a story." |
| **0:55–1:05** | The order card: green pin, "Cheapest of N stores, saves $X", the 10-minute undo | Point at the store comparison | "It even shows how much it saved, and I can cancel within ten minutes." |
| **1:05–1:25** | **Claude Desktop** | Type: **"Use Kart to buy me wireless earbuds for the gym under $50, and running shoes around $90."** | "And Kart isn't another chatbot. It's an MCP server, so the agent I already use, here Claude Desktop, shops through Kart under the same rules." |
| **1:25–1:42** | Back in Kart: the **approval card** with an amber pin, then **"Stopped by your rules"** with a red pin and **"No money moved"** | Click **Confirm & pay** on the earbuds | "Earbuds at $45 are in the amber zone, so Kart asks me first. The $90 shoes are over my max: blocked, and no money moves. No prompt can talk an agent past these rules, because they're enforced in Kart's code, not in the AI." |
| **1:42–1:55** | **Connected agents**: permissions, budget bar, expiry | Toggle "Can pay on its own" off, then on | "Each agent also gets a smaller box than me: its own monthly budget, a key that expires, and it can't pay on its own until I allow it. One tap disconnects it." |
| **1:55–2:08** | **Store side**: the orders arrive already paid. Click **Ship** and enter a tracking number. | Ship the socks order | "Stores get orders that are already paid through PayPal. The store adds tracking, and Kart adds it to the PayPal transaction." |
| **2:08–2:25** | Kart chat: attach the damaged photo, type **"My earbuds arrived cracked"** | Claude checks the photo, then the "money back" card appears | "If something goes wrong, the Kart Guarantee pays me back first. Claude checks the photo against the product, and PayPal refunds me in seconds. Kart then settles with the store." |
| **2:25–2:37** | **Insights** (AG Studio): click **Ask Kart AI** and type **"Which agent spent the most this month?"** | Let it answer | "And I can see everything my agents did, and ask about it. This dashboard is AG Studio, running on Claude." |
| **2:37–2:45** | **PayPal sandbox**: buyer and business activity showing the payment, payout and refund | Quick cuts | "All of it is real PayPal: Orders, Vault, Payouts, Refunds, tracking and webhooks, in the sandbox." |
| **2:45–2:50** | Kart logo and tagline | — | "Kart: the trust layer for AI agents that spend money." |

---

## What each shot proves to the judges

| Judging criterion / prize | Where it shows |
|---|---|
| Best Use of Agentic Commerce | Claude Desktop buying through Kart's MCP server, and the per-agent permissions |
| Technological implementation | The live trace (real events), live price re-check, MCP, PayPal Vault and Payouts and Refunds, and Claude vision checking the photo |
| Design | The Rule Lane on the home screen and the approval, blocked and order cards |
| Potential impact | Rules before the purchase, money back after it: the reasons people don't trust agents with money today |
| Innovation | Rules enforced outside the AI, a smaller budget for each agent, and a refund-first guarantee |
| Channel3 prize | "Cheapest of N stores", live price re-check, photo search (optional extra shot) |
| AG Grid prize | The Insights dashboard and its AI assistant |

Pick **one** sponsor prize on Devpost. If you choose Channel3, add a 5-second photo-search shot ("find shoes like this" with a photo). If you choose AG Grid, give Insights 5 more seconds: show the guardrail widget and edit one chart.

---

## Recording tips

- Record each shot separately and cut them together. Speed up waits (Claude thinking, PayPal loading) to 2x, but leave the trace at normal speed: it is the "wow" moment.
- Turn on cursor highlighting. Zoom in (for example, 150%) on the pins and the "No money moved" line.
- Speak slowly. About 150 words per minute fits this script.
- If a price lands in the wrong zone on the day, change the request ("under $15", "around $40") instead of the rules, so the $30 / $50 story stays the same.
- Never show `.env.local`, API keys, the Claude Desktop config with the key, or your PayPal password. Blur the agent key on the Connected agents page.
- Add captions. Many judges watch without sound.

---

## Devpost description (paste and adjust)

**Kart is the trust layer for AI agents that spend money.** Any agent, whether Kart's own chat agent, Claude Desktop, ChatGPT or Cursor, can shop through Kart, which works as an MCP server. The shopper's rules decide what gets paid: Kart pays on its own under the auto-buy limit, asks above it, and never goes past the per-item max or monthly cap. Each connected agent gets its own budget, expiry and permission to pay on its own (off by default).

Channel3 finds the cheapest store selling the exact product, and Kart re-checks the live price right before paying. PayPal moves the money: Orders, Vault for one-tap, Payouts and Refunds, tracking and webhooks. If something goes wrong, the Kart Guarantee pays the shopper back first, with Claude checking damage photos, and Kart settles with the store.

Shoppers see every decision on the Rule Lane and in a live step-by-step trace, and can ask questions about their spending in an AG Studio dashboard. Stores verify their domain, connect PayPal and receive orders that are already paid.

**Built with:** PayPal (Orders v2, Vault, Payouts, Refunds, Partner Referrals, Tracking, Webhooks, Agent Toolkit), Claude (Anthropic), Channel3, AG Studio (AG Grid), Next.js, Neon Postgres, Clerk.
