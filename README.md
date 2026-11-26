This is the [Next.js](https://nextjs.org) app for [mudrc.sk](https://www.mudrc.sk).

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Mock payment staging (`pay.mudrc.sk`)

- Local: [http://localhost:3000/pay](http://localhost:3000/pay)
- DNS / Vercel: [`hosting/pay.mudrc.sk/README.md`](hosting/pay.mudrc.sk/README.md)
- Overview: [`docs/pay-staging.md`](docs/pay-staging.md)

Card checkout is **mock only** (instant paid) — no Stripe yet.

### Finance sync (`fin.mudrc.sk`)

- Read-only expected incomes endpoint: `GET /api/finance/expected-incomes` (`Authorization: Bearer <FINANCE_SYNC_TOKEN>`)
- Automatic fire-and-forget webhook ping on registration changes (`POST https://fin.mudrc.sk/api/mudrc-sync.php`, optional `FINANCE_WEBHOOK_URL`)
- Setup & Vercel env docs: [`docs/finance-sync.md`](docs/finance-sync.md)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
