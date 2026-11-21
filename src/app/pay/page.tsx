import Link from "next/link";
import { listPayQuizzes } from "@/lib/pay-events";
import { payRequestContext } from "@/lib/pay-request";
import { formatEuroAmount } from "@/lib/registration-utils";

export const dynamic = "force-dynamic";

export default async function PayHomePage() {
  const { href } = payRequestContext();
  const quizzes = await listPayQuizzes();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-3 text-center sm:text-left">
        <p className="text-sm font-semibold text-brand-orange-readable uppercase tracking-wider">Mudrc · staging</p>
        <h1 className="font-display text-5xl md:text-6xl text-brand-text uppercase tracking-wide leading-none">
          Predplatné miesta
        </h1>
        <p className="text-brand-muted">
          Kapitán zaregistruje tím → rovno platba (pay-link). Cena podľa času platby:{" "}
          <strong>4 €</strong> (≥24 h) · <strong>5 €</strong> (&lt;24 h) · <strong>6 €</strong> walk-up (od 10 min
          pred štartom). Na testovanie použi <strong>TEST Platby — Silvester</strong> (31.12.2026).
        </p>
      </header>

      {quizzes.length === 0 ? (
        <p className="text-brand-muted text-center">Žiadne nadchádzajúce kvízy v dátach.</p>
      ) : (
        <ul className="space-y-3">
          {quizzes.map((q) => {
            const withDate = href(`/r/${q.eventSlug}?date=${encodeURIComponent(q.quizDate)}`);
            const checkIn = href(`/check-in/${q.eventSlug}?date=${encodeURIComponent(q.quizDate)}`);
            const walkUp = href(`/walk-up/${q.eventSlug}?date=${encodeURIComponent(q.quizDate)}`);
            return (
              <li
                key={q.listingKey}
                className="rounded-2xl border border-brand-border bg-brand-card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="font-semibold text-lg text-brand-text">
                    {q.venue}
                    <span className="text-brand-muted font-normal"> · {q.city}</span>
                    {q.stagingDemo ? (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-brand-orange-readable">
                        E2E demo
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-brand-muted mt-1">{q.whenLabel}</div>
                  <div className="text-sm text-brand-muted mt-1">
                    {formatEuroAmount(q.earlyFee)} / {formatEuroAmount(q.lateFee)} / {formatEuroAmount(q.walkUpFee)}
                    {" · "}
                    teraz {formatEuroAmount(q.onlineLocked ? q.walkUpFee : q.prepaidPrice)}
                    {q.onlineLocked ? " (walk-up)" : q.pricing.tier === "early" ? " (skoré)" : " (neskoré)"}
                    {` · ${q.minPlayers}–${q.maxPlayers} hráčov`}
                    {q.started
                      ? " · po štarte"
                      : q.onlineLocked
                        ? " · online uzamknuté"
                        : q.registrationOpen
                          ? ""
                          : " · registrácia zatvorená"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {q.registrationOpen && !q.onlineLocked ? (
                    <Link href={withDate} className="btn-primary text-sm px-4 py-2">
                      Registrovať tím
                    </Link>
                  ) : (
                    <Link href={walkUp} className="btn-primary text-sm px-4 py-2">
                      Walk-up {formatEuroAmount(q.walkUpFee)}
                    </Link>
                  )}
                  <Link href={checkIn} className="btn-outline text-sm px-4 py-2">
                    Check-in
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-brand-muted max-w-xl mx-auto sm:mx-0 text-center sm:text-left">
        Lokálne: otvor <code className="text-brand-text">/pay</code>. Produkčný staging: doména{" "}
        <code className="text-brand-text">pay.mudrc.sk</code> (rovnaká Vercel app, rewrite na /pay). Žiadny Stripe.
      </p>
    </div>
  );
}
