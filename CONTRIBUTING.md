# Contributing to Kart

Thanks for your interest. Kart started as a PayPal AI Hackathon 2026 entry and is open source under the MIT License.

## Run it

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # then fill in the keys
npm run dev
```

The README's **Getting started** section explains each key and the PayPal sandbox setup.

## Before you open a pull request

1. `npm run build` must pass. It runs ESLint and the TypeScript check.
2. Keep money logic on the server. Anything that decides whether to charge belongs in `lib/guard.ts` or `lib/orders.ts`, never in a component or a prompt.
3. Every new API route needs a role check, input checks and, if it changes something, the cross-site request check (see `lib/http.ts` and `middleware.ts`).
4. Never commit keys, `.env.local` or `.data/`.

## Where things are

The README's **Project structure** section maps the folders. Good first places to read: `lib/agent.ts` (the Claude agent), `lib/mcp.ts` (the MCP server), `lib/guard.ts` (spending rules) and `components/RuleLane.tsx` (the Rule Lane).

## Security problems

Please report them privately. See [SECURITY.md](SECURITY.md).
