# Mock payment staging (pay.mudrc.sk)

See also: [`hosting/pay.mudrc.sk/README.md`](../hosting/pay.mudrc.sk/README.md).

## Scope (this build)

- Captain registers team (**email required**) → hold **N** seats until quiz start → **one shared team pay-link** → each person pays one seat.
- Clicking card payment **auto-succeeds** (mock). No Stripe / SK PSP.
- Prepaid price = event `entryFee` (usually 4 €). Walk-up = `entryFee` + `NEXT_PUBLIC_WALK_UP_SURCHARGE_EUR` (default +1 €).
- Events/quizzes loaded from the same storage as the main site.
- Check-in list of `paid` seats + mock walk-up.

## Out of scope

- Real PSP, webhooks, receipts, refunds automation, SMS.
