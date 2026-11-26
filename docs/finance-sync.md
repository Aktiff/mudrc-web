# Finance Sync (`GET /api/finance/expected-incomes`)

Read-only JSON feed used by `fin.mudrc.sk` to pull expected quiz entry revenues from `mudrc.sk` without exposing PII or admin write credentials.

## Environment Variable (Vercel)

Set the following variable in the `mudrc-web` Vercel project (**Settings → Environment Variables**) and redeploy:

| Variable | Required | Scope | Notes |
|----------|----------|-------|-------|
| `FINANCE_SYNC_TOKEN` | Yes | Production (and Preview if testing preview deploys) | High-entropy random secret (e.g. 32-byte hex). Must match `mudrc_sync_token` in `fin.mudrc.sk` `config.local.php`. **Never commit the token to git.** |

If `FINANCE_SYNC_TOKEN` is unset or empty, the endpoint returns `503 Service Unavailable`.

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
