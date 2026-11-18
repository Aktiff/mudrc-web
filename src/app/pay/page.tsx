import Link from "next/link";
import { listPayQuizzes } from "@/lib/pay-events";
import { payRequestContext } from "@/lib/pay-request";
import { formatEuroAmount } from "@/lib/registration-utils";

export const dynamic = "force-dynamic";

export default async function PayHomePage() {
  const { href } = payRequestContext();
  const quizzes = await listPayQuizzes();

  return (
    <div className="space-y-8">
      <header className="space-y-3 max-w-2xl">
        <p className="text-sm font-semibold text-brand-orange-readable uppercase tracking-wider">Mudrc · staging</p>
        <h1 className="font-display text-5xl md:text-6xl text-brand-text uppercase tracking-wide leading-none">
          Predplatné miesta
        </h1>
        <p className="text-brand-muted">
          Kapitán zaregistruje tím (e-mail povinný) → jeden zdieľateľný pay-link → každý zaplatí jedno miesto.
          Mock platba kartou okamžite potvrdí rezerváciu. Rovnaké podniky a termíny ako na mudrc.sk.
        </p>
      </header>

      {quizzes.length === 0 ? (
        <p className="text-brand-muted">Žiadne nadchádzajúce kvízy v dátach.</p>
      ) : (
        <ul className="space-y-3">
          {quizzes.map((q) => {
            const withDate = href(`/r/${q.eventSlug}?date=${encodeURIComponent(q.quizDate)}`);
            const checkIn = href(`/check-in/${q.eventSlug}?date=${encodeURIComponent(q.quizDate)}`);
            return (
              <li
                key={q.listingKey}
                className="rounded-2xl border border-brand-border bg-brand-card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="font-semibold text-lg text-brand-text">
                    {q.venue}
                    <span className="text-brand-muted font-normal"> · {q.city}</span>
                  </div>
                  <div className="text-sm text-brand-muted mt-1">{q.whenLabel}</div>
                  <div className="text-sm text-brand-muted mt-1">
                    Predplatné {formatEuroAmount(q.prepaidPrice)} · walk-up {formatEuroAmount(q.walkUpPrice)}
                    {q.started ? " · po štarte" : q.registrationOpen ? "" : " · registrácia zatvorená"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {q.registrationOpen ? (
                    <Link href={withDate} className="btn-primary text-sm px-4 py-2">
                      Registrovať tím
                    </Link>
                  ) : (
                    <span className="text-sm text-brand-muted self-center">Online rezervácia ukončená</span>
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

      <p className="text-xs text-brand-muted max-w-xl">
        Lokálne: otvor <code className="text-brand-text">/pay</code>. Produkčný staging: doména{" "}
        <code className="text-brand-text">pay.mudrc.sk</code> (rovnaká Vercel app, rewrite na /pay). Žiadny Stripe.
      </p>
    </div>
  );
}
