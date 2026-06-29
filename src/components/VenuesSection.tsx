import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

const highlights = [
  "Výrazné zvýšenie tržieb na bare a v kuchyni",
  "Technické zabezpečenie a skúsený moderátor",
  "Propagácia podujatia a prilákanie nových zákazníkov",
  "Žiadne skryté alebo fixné poplatky",
];

export default function VenuesSection() {
  return (
    <section id="podniky" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">Pre podniky</span>
          <h2 className="section-title mt-2">
            Chcete mať plný podnik<br />
            <span className="text-gradient">aj cez týždeň?</span>
          </h2>
          <p className="text-brand-muted text-lg leading-relaxed mt-6 mb-8">
            Hľadáme nové partnerské reštaurácie a bary, ktoré chcú premeniť slabšie dni na večery plné hostí a skvelej atmosféry. O organizáciu a reklamu sa postaráme my, spoločne s vaším prezdieľaním na sociálnych sieťach.
          </p>
          <ul className="space-y-3 mb-10">
            {highlights.map((p) => (
              <li key={p} className="flex items-center gap-3 text-brand-muted">
                <CheckCircle className="w-5 h-5 text-brand-orange shrink-0" />
                {p}
              </li>
            ))}
          </ul>
          <Link href="/podniky" className="btn-primary text-base px-8 py-4 inline-flex">
            Chcem plný podnik
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
        {/* Venue info card */}
        <div
          className="rounded-3xl p-10 border border-brand-border flex flex-col gap-6"
          style={{ background: "var(--venue-gradient)" }}
        >
          <h3 className="font-display text-4xl text-brand-text">Ako to funguje?</h3>
          <p className="text-brand-muted leading-relaxed">
            Prídeme, pozrieme si priestor a vyberieme ideálny deň v týždni. Vy len pripravíte stoly a zabezpečíte drobné ceny pre víťazov – o zvyšok sa postaráme my.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-brand-border">
            <div>
              <div className="font-display text-4xl text-brand-text">2–3 h</div>
              <div className="text-brand-muted text-sm">dĺžka kvízu</div>
            </div>
            <div>
              <div className="font-display text-4xl text-brand-text">0 €</div>
              <div className="text-brand-muted text-sm">fixné náklady pre podnik</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
