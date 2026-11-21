# pay.mudrc.sk — mock payment staging

Staging app for prepaid seats + mock card checkout. **No real PSP / Stripe.** Same Next.js deployment as mudrc.sk; host rewrite serves `/pay/*` at the subdomain root.

## What Ľuboš must do (DNS + Vercel)

1. **DNS** (domain registrar / Cloudflare / HostCreators DNS for `mudrc.sk`):
   - Add `CNAME` (or Vercel-recommended record) for `pay` → `cname.vercel-dns.com`  
     (or the target Vercel shows when you add the domain).
2. **Vercel project** (same project as www.mudrc.sk):
   - Settings → Domains → **Add** `pay.mudrc.sk`
   - Wait for HTTPS certificate (automatic).
3. **Env** on the Vercel project:
   - `RESEND_API_KEY` — **required** for payment confirmation emails (and main-site registration notify). Redeploy after adding.
   - `REGISTRATION_EMAIL_FROM` — From address, e.g. `Mudrc Kvíz <kontakt@mudrc.sk>` (domain must be verified in Resend)
   - `PAY_CHECKIN_PIN` — PIN for check-in / walk-up (defaults to `ADMIN_PASSWORD` or `mudrc2026`)
   - Blob storage already used by the main site: pay bookings store as `pay-bookings` in the same Blob
   - (Optional legacy) `NEXT_PUBLIC_WALK_UP_SURCHARGE_EUR` — unused when event has `walkUpFee`; prefer event fees 4/5/6
4. Redeploy after domain + env are set.

After that, open `https://pay.mudrc.sk/` — you should see the staging banner and quiz list from the same events as mudrc.sk.

## Pricing (payment time)

| Window | Price / seat |
|--------|----------------|
| ≥ 24 h before start | **4 €** online |
| &lt; 24 h until 10 min before start | **5 €** online |
| &lt; 10 min before start | online locked · walk-up **6 €** on site |

Cancel: ≥ 24 h → refund **50 %** of paid; &lt; 24 h → **0 %** (UI/data ready; real PSP later).

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000/pay](http://localhost:3000/pay).

Bookings persist to `src/data/pay-bookings.local.json` when Blob is not configured.

To simulate the subdomain locally, map `pay.localhost` in `/etc/hosts` and set `PAY_FORCE_HOST=1`, or just use the `/pay` path.

## Test flow

1. `/pay` → **TEST Platby — Silvester** (`test-platby-silvester`, 31.12.2026) → **Registrovať tím** (name, N seats, phone, **email**).
2. After success you are **redirected straight to the team pay page** (`/s/<token>`). Team dashboard (`/t/<token>`) still has the shareable pay-link + **Pridať člena** (up to `maxPlayers`) while online is open.
3. On the pay page → choose **1..remaining** unpaid seats (total = quantity × **current tier**) → optional payer email → **Zaplatiť kartou (mock)** → seats mark paid at the tier price at click time + confirmation email when Resend is configured.
4. Others reuse the **same** link until seats are gone or online locks at T-10min; then walk-up **6 €**.
5. `/pay/check-in/<slug>?date=...` + PIN → check-in paid seats; **Walk-up** for on-site **6 €**.

## Routes

| Path on main site | On pay.mudrc.sk |
|-------------------|-----------------|
| `/pay` | `/` |
| `/pay/r/<slug>` | `/r/<slug>` |
| `/pay/t/<teamToken>` | `/t/<teamToken>` (captain dashboard) |
| `/pay/s/<teamToken>` | `/s/<teamToken>` (shared team pay link) |
| `/pay/p/<seatToken>` | `/p/<seatToken>` (legacy per-seat; optional) |
| `/pay/check-in/<slug>` | `/check-in/<slug>` |
| `/pay/walk-up/<slug>` | `/walk-up/<slug>` |

APIs: `POST /api/pay/register`, `/api/pay/checkout`, `/api/pay/add-seat`, `/api/pay/walk-up`, `/api/pay/check-in`.
