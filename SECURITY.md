# Security

Kart moves money (PayPal sandbox today), so security reports are welcome.

## Reporting a problem

Please **don't open a public issue** for a security problem. Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository. Include the steps to reproduce it and what an attacker could do. You'll get a reply within a few days.

## How Kart is protected

- **Money decisions happen on the server.** Prices come from Channel3, never from the browser or an agent. A purchase needs a signed, single-use, 10-minute confirmation bound to the product and exact price. The AI has no tool that can create one.
- **Spending rules live in code, not in the prompt.** Auto-buy limit, max per item, monthly cap and orders per hour are checked before every charge, for Kart's own agent and for every connected agent.
- **Agent keys** are 192-bit random secrets. Only a SHA-256 hash is stored, and the key is shown once. Each key has its own permissions, monthly budget and expiry, and can be disconnected instantly.
- **Sessions** are HMAC-signed, httpOnly cookies that expire after 30 days. In production Kart refuses to sign with a default secret.
- **Every change must come from Kart's own pages** (cross-site request check). PayPal webhooks are accepted only with a valid PayPal signature.
- **Rate limits and size caps** on chat, claims, the MCP endpoint, sign-ins and store actions.
- **Stores** prove they own their domain, see only their own orders, and Kart never fetches private network addresses when verifying a site.
- **Private data:** each shopper's data is separate. Photos open only for the shopper who added them. PayPal tokens and shopper emails never reach the browser or a store.

## Secrets

All keys live in environment variables (see `.env.example`). `.env.local` and `.data/` are ignored by git. Never commit real keys; if one leaks, rotate it with its provider.
