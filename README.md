# Splitmate

Splitmate is a group-expense agent for the Orion hackathon. It turns messy shared expenses into a short settlement plan and lets each payer approve a real USDC payment on Base.

## Demo flow

1. Create a group and add people.
2. Optionally attach each person's Base wallet address.
3. Add expenses.
4. Split expenses equally between selected people.
5. The agent calculates balances and minimizes transfers.
6. A payer connects a supported wallet through RainbowKit.
7. Splitmate checks that the connected wallet matches the payer's saved wallet.
8. The payer approves USDC on Base.
9. Splitmate waits for the receipt and links the confirmed transaction on BaseScan.

## Run locally

```bash
npm install
npm run dev
```

Do not double-click `index.html`. Run the Vite server and open the localhost URL it prints.

## Build

```bash
npm run build
```

## Vercel

Vercel uses `npm run build`, outputs `dist`, and rewrites SPA routes to `index.html`.

Set these environment variables in Vercel. Keep the OpenAI and Supabase service-role keys server-side and never prefix them with `VITE_`:

`VITE_WALLETCONNECT_PROJECT_ID=e70b6f7139e332bfd60983bf4910d319`

`OPENAI_API_KEY=...`

`OPENAI_MODEL=gpt-5.4-nano`

`SUPABASE_URL=...`

`SUPABASE_SERVICE_ROLE_KEY=...`

## Base

Network: Base mainnet.

Native USDC contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

Payments are real mainnet transactions. Test with a small amount before demonstrating.
