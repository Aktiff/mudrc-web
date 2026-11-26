# Finance Sync (`fin.mudrc.sk`)

Read-only JSON feed (`GET /api/finance/expected-incomes`) and fire-and-forget webhook ping used to keep expected quiz entry revenues on `fin.mudrc.sk` automatically in sync with `mudrc.sk` without exposing PII or admin write credentials.

## Environment Variables (Vercel)

Set the following variables in the `mudrc-web` Vercel project (**Settings → Environment Variables**) and redeploy:

| Variable | Required | Scope | Notes |
|----------|----------|-------|-------|
| `FINANCE_SYNC_TOKEN` | Yes | Production (and Preview if testing preview deploys) | High-entropy random secret (e.g. 32-byte hex). Must match `mudrc_sync_token` in `fin.mudrc.sk` `config.local.php`. **Never commit the token to git.** |
| `FINANCE_WEBHOOK_URL` | No | Production | Optional override for the webhook ping URL. Defaults to `https://fin.mudrc.sk/api/mudrc-sync.php`. Set to `off` / `disabled` to temporarily pause outbound pings. |

If `FINANCE_SYNC_TOKEN` is unset or empty, `GET /api/finance/expected-incomes` returns `503 Service Unavailable` and outbound webhook pings are skipped.

## Endpoint

- **URL:** `GET /api/finance/expected-incomes`
- **Auth:** `Authorization: Bearer <FINANCE_SYNC_TOKEN>` (constant-time comparison)
- **Caching:** `Cache-Control: private, no-store, max-age=0, must-revalidate`
- **Side-effects:** None (strictly read-only; no writes to Vercel Blob).

### Calculation & Filtering

- Uses the same per-term math as `/admin/registracie`: `estimatedEntryRevenue(event.entryFee, players_count)` (`Math.round(entryFee * players * 100) / 100`).
- Merges classic web registrations with non-cancelled, non-mock prepaid bookings in-memory and deduplicates same-team slots without modifying storage.
- Excludes:
  - inactive events (`active === false`),
  - external events (`externalUrl` set, e.g. `silvester-2026`),
  - test/staging events (`test-platby-silvester`, `pay-staging-demo`),
  - zero-fee events and zero-revenue terms (`estimated_amount <= 0`),
  - past terms (`expected_date < today` in `Europe/Bratislava`) from `upcoming`.
- Returns **zero PII** (no phone numbers, emails, or team names).
- Stable term keys: `mudrc:<event_slug>:<YYYY-MM-DD>`.
- Also includes `recent_played` (last 14 days of `pastResults` with real non-estimated player counts and positive earned amount) for optional actuals reconciliation.

### Response Example

```json
{
  "generated_at": "2026-11-26T20:30:00+01:00",
  "currency": "EUR",
  "totals": {
    "upcoming_terms": 1,
    "teams_count": 7,
    "players_count": 32,
    "estimated_amount": 128
  },
  "upcoming": [
    {
      "external_key": "mudrc:lili-cafe:2026-11-27",
      "event_slug": "lili-cafe",
      "venue": "Lili Cafe",
      "city": "Oslany",
      "quiz_type": "Všeobecný kvíz",
      "expected_date": "2026-11-27",
      "time": "19:00",
      "entry_fee": 4,
      "teams_count": 7,
      "players_count": 32,
      "estimated_amount": 128,
      "paid_seats": 0,
      "pending_seats": 0
    }
  ],
  "recent_played": []
}
```

## Automatic Webhook Ping (Mudrc → Fin)

After every successful registration mutation on `mudrc.sk`, `triggerFinanceSyncWebhook()` (`src/lib/finance-webhook.ts`) sends an asynchronous, fire-and-forget `POST` ping so `fin.mudrc.sk` immediately pulls the latest `/api/finance/expected-incomes` snapshot:

- **Target:** `POST https://fin.mudrc.sk/api/mudrc-sync.php` (overridable via `FINANCE_WEBHOOK_URL`)
- **Auth:** `Authorization: Bearer <FINANCE_SYNC_TOKEN>`
- **Body (zero PII):** `{"source":"mudrc-web","reason":"registration.create|update|delete|cancel","triggered_at":"<ISO-8601>"}`
- **Non-blocking:** Attached to Vercel's `waitUntil` request context (`Symbol.for("@vercel/request-context")`) when running on Vercel, with an 8 s `AbortSignal.timeout`. Errors and timeouts are logged only and never fail or delay registrations.
- **No sync logic on Vercel:** `mudrc.sk` only sends the ping; `fin.mudrc.sk` pulls `/api/finance/expected-incomes` and runs `mudrc_sync_apply()` itself.

### Routes that trigger the ping

- `POST /api/register` — public registration create/overwrite (`registration.create`)
- `POST /api/admin/registrations` — admin manual registration create/overwrite (`registration.create`)
- `PATCH /api/admin/registrations` — admin player count or quiz date update (`registration.update`)
- `DELETE /api/admin/registrations` — admin single delete/cancel, batch `ids`, or bulk `slug`/`venue` delete (`registration.delete` / `registration.cancel`)
- `DELETE /api/admin/events/[slug]` — when deleting a venue purges stored registrations (`registration.delete`)
- `POST /api/pay/register`, `POST /api/pay/add-seat`, `POST /api/pay/walk-up` — guarded behind `!team.mock` (no pings while `PAY_MOCK_MODE` is enabled)

Staging/test slugs (`test-platby-silvester`, `pay-staging-demo`) are skipped automatically.

## Verification

```bash
# 1. Unauthenticated request must return 401
curl -i https://www.mudrc.sk/api/finance/expected-incomes

# 2. Wrong token must return 401
curl -i -H "Authorization: Bearer wrong-token" https://www.mudrc.sk/api/finance/expected-incomes

# 3. Valid Bearer token returns 200 with aggregated expected incomes (no PII)
curl -sS -H "Authorization: Bearer <FINANCE_SYNC_TOKEN>" https://www.mudrc.sk/api/finance/expected-incomes

# 4. Unauthenticated GET /api/register must return 401 (no phone leak)
curl -i https://www.mudrc.sk/api/register
```
