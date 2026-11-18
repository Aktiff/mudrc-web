# Mock payment staging (pay.mudrc.sk)

See also: [`hosting/pay.mudrc.sk/README.md`](../hosting/pay.mudrc.sk/README.md).

## Scope (this build)

- Captain registers team (**email required**) → hold **N** seats until quiz start → **one shared team pay-link** → pay **1..remaining** unpaid seats in one checkout (quantity × entryFee).
- Clicking card payment **auto-succeeds** (mock). No Stripe / SK PSP.
- If the payer enters an **email at checkout**, **one payment confirmation** is sent via Resend covering all seats in that payment.
- Captain can **add seats** after registration up to the quiz **`maxPlayers`** (team max from event rules).
- Prepaid price = event `entryFee` (usually 4 €). Walk-up = `entryFee` + `NEXT_PUBLIC_WALK_UP_SURCHARGE_EUR` (default +1 €).
- Events/quizzes loaded from the same storage as the main site. Preferred dry-run venue: **TEST Platby — Silvester** (`test-platby-silvester`, **31.12.2026**, max 8) — created automatically in Blob and visible on mudrc.sk. Synthetic `pay-staging-demo` remains as fallback.
- Payment confirmation email goes to the **payer address typed at checkout** (not the captain), via Resend.
- Bookings persist in Vercel Blob (`pay-bookings`). Register waits until the team is readable (avoids a brief 404 right after submit).
- Customer-facing seat statuses use Slovak labels (`zaplatené`, `čaká sa na zaplatenie`).
- Check-in list of paid seats + mock walk-up (staff PIN page).

## Env (Vercel — same project as mudrc.sk)

| Variable | Required for | Notes |
|----------|--------------|--------|
| `RESEND_API_KEY` | Payment confirmation + registration notify | Already used by `/api/register`. Redeploy after set. |
| `REGISTRATION_EMAIL_FROM` | From address | e.g. `Mudrc Kvíz <kontakt@mudrc.sk>` (verified domain in Resend) |
| `REGISTRATION_NOTIFY_EMAIL` | Admin notify on main-site registration | Not used for payer confirmations |
| `PAY_CHECKIN_PIN` | Check-in / walk-up | Optional; defaults to `ADMIN_PASSWORD` / `mudrc2026` |
| `NEXT_PUBLIC_WALK_UP_SURCHARGE_EUR` | Walk-up price | Default `1` |

## Out of scope

- Real PSP, webhooks, fiscal receipts, refunds automation, SMS.
