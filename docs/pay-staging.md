# Mock payment staging (pay.mudrc.sk)

See also: [`hosting/pay.mudrc.sk/README.md`](../hosting/pay.mudrc.sk/README.md).

## Scope (this build)

- Captain registers team (**email required**) → hold **N** seats until quiz start → **one shared team pay-link** → each person pays one seat.
- Clicking card payment **auto-succeeds** (mock). No Stripe / SK PSP.
- If the payer enters an **email at checkout**, a **payment confirmation** is sent via Resend (same stack as registration notify).
- Captain can **add seats** after registration up to the quiz **`maxPlayers`** (team max from event rules).
- Prepaid price = event `entryFee` (usually 4 €). Walk-up = `entryFee` + `NEXT_PUBLIC_WALK_UP_SURCHARGE_EUR` (default +1 €).
- Events/quizzes loaded from the same storage as the main site, plus a synthetic **Staging demo kvíz** (`pay-staging-demo`) always open for E2E tests. Prefer a **real upcoming venue** from the list for a realistic dry-run.
- Bookings persist in Vercel Blob (`pay-bookings`). Register waits until the team is readable (avoids a brief 404 right after submit).
- Check-in list of `paid` seats + mock walk-up.

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
