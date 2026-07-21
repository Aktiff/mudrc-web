import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Informácie o cookies a ukladaní údajov na webe Mudrc Kvíz.",
};

export default function CookiesPage() {
  return (
    <div className="pt-28 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <p className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider mb-2">Právne informácie</p>
        <h1 className="font-display text-4xl sm:text-5xl text-brand-text tracking-wide mb-6">Cookies a ukladanie údajov</h1>

        <div className="card space-y-8 text-sm sm:text-base text-brand-muted leading-relaxed">
          <section>
            <h2 className="font-semibold text-brand-text text-lg mb-2">Čo používame</h2>
            <p>
              Web mudrc.sk nevyužíva marketingové alebo sledovacie cookies tretích strán (napr. Google Analytics). Ukladáme
              len to, čo je potrebné na pohodlné používanie stránky.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-brand-text text-lg mb-3">Prehľad</h2>
            <ul className="space-y-4">
              <li className="border-l-2 border-brand-orange pl-4">
                <p className="font-medium text-brand-text">Súhlas s cookies (localStorage)</p>
                <p className="mt-1">
                  Kľúč <code className="text-xs bg-brand-hover px-1.5 py-0.5 rounded">cookie-consent</code> — zapamätá,
                  že ste si prečítali upozornenie. Ukladá sa až po kliknutí na „Súhlasím“.
                </p>
              </li>
              <li className="border-l-2 border-brand-orange pl-4">
                <p className="font-medium text-brand-text">Téma webu (localStorage)</p>
                <p className="mt-1">
                  Kľúč <code className="text-xs bg-brand-hover px-1.5 py-0.5 rounded">theme</code> — svetlá alebo tmavá
                  téma podľa vášho výberu v hlavičke stránky.
                </p>
              </li>
              <li className="border-l-2 border-brand-orange pl-4">
                <p className="font-medium text-brand-text">Admin prihlásenie (cookie)</p>
                <p className="mt-1">
                  Cookie <code className="text-xs bg-brand-hover px-1.5 py-0.5 rounded">admin_session</code> sa nastaví
                  len pri prihlásení do administrácie a slúži na ochranu admin rozhrania. Bežní návštevníci ju nedostanú.
                </p>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-brand-text text-lg mb-2">Ako zmeniť alebo vymazať údaje</h2>
            <p>
              Údaje v localStorage môžete kedykoľvek vymazať v nastaveniach prehliadača (úložisko stránky / cookies a
              údaje stránok). Po vymazaní sa môže znova zobraziť lišta o cookies a resetnúť sa preferencia témy.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-brand-text text-lg mb-2">Kontakt</h2>
            <p>
              Otázky k ochrane údajov a cookies smerujte na{" "}
              <a href="mailto:kontakt@mudrc.sk" className="text-brand-orange-readable font-medium hover:underline">
                kontakt@mudrc.sk
              </a>
              .
            </p>
          </section>

          <p>
            <Link href="/" className="text-brand-orange-readable font-medium hover:underline">
              ← Späť na úvod
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
