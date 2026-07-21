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
            <h2 className="font-semibold text-brand-text text-lg mb-2">Stručne</h2>
            <p>
              Na webe mudrc.sk vás nesledujeme reklamnými ani štatistickými nástrojmi tretích strán. Nepoužívame Google
              Analytics ani podobné služby. Ukladáme len pár vecí vo vašom prehliadači, aby stránka fungovala pohodlne.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-brand-text text-lg mb-3">Čo sa u vás môže uložiť</h2>
            <ul className="space-y-4">
              <li className="border-l-2 border-brand-orange pl-4">
                <p className="font-medium text-brand-text">Súhlas s upozornením o cookies</p>
                <p className="mt-1">
                  Ak kliknete na „Súhlasím“ v lište dole, prehliadač si zapamätá, že ste upozornenie videli, aby sa
                  nezobrazovalo stále dokola.
                </p>
              </li>
              <li className="border-l-2 border-brand-orange pl-4">
                <p className="font-medium text-brand-text">Svetlá alebo tmavá téma</p>
                <p className="mt-1">
                  Keď si v hlavičke prepnete vzhľad stránky, prehliadač si váš výber zapamätá na ďalšiu návštevu.
                </p>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-brand-text text-lg mb-2">Registrácia na kvíz</h2>
            <p>
              Údaje z registračného formulára (tím, kontakt) posielame na náš server kvôli organizácii kvízu — nie ide o
              cookies v prehliadači. O spracovaní týchto údajov vás informujeme pri registrácii a v prípade otázok nás
              kontaktujte.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-brand-text text-lg mb-2">Ako to vymazať</h2>
            <p>
              V nastaveniach prehliadača môžete vymazať cookies a údaje uložené pre túto stránku. Potom sa môže znova
              zobraziť lišta o cookies a znova si zvolíte tému.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-brand-text text-lg mb-2">Kontakt</h2>
            <p>
              Otázky k cookies a osobným údajom píšte na{" "}
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
