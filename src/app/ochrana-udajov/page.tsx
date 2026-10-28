import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Ochrana osobných údajov",
  description: "Ako Mudrc Kvíz spracúva údaje z registrácie tímu a príspevkov na Facebooku.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-brand-bg pt-16">
      <section className="bg-brand-warm border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">
            Právne informácie
          </span>
          <h1 className="font-display text-5xl sm:text-6xl text-brand-text tracking-wide mt-3">
            OCHRANA ÚDAJOV
          </h1>
          <p className="text-brand-muted text-lg mt-4 leading-relaxed max-w-2xl">
            Prevádzkovateľ webu mudrc.sk je Mudrc Kvíz. Kontakt:{" "}
            <a href="mailto:kontakt@mudrc.sk" className="text-brand-orange-readable hover:underline">
              kontakt@mudrc.sk
            </a>
            , telefón 0951 457 439.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8 text-brand-muted leading-relaxed">
        <div className="card p-6 sm:p-8 space-y-3">
          <h2 className="font-display text-2xl text-brand-text tracking-wide">Registrácia na kvíz</h2>
          <p>
            Pri prihlásení tímu ukladáme názov tímu, počet hráčov, telefónne číslo a kvíz (podnik, dátum).
            Číslo slúži na potvrdenie účasti a na správu o danom kvíze.
          </p>
          <p>
            Údaje držia, kým je tím prihlásený na kvíz. Kontakt tímu si môžeme ponechať aj po kvíze, aby sa dal
            pozvať na ďalší termín v tom istom podniku. Vymazanie vyžiadate na{" "}
            <Link href="/vymazanie-udajov" className="text-brand-orange-readable hover:underline">
              stránke o vymazaní údajov
            </Link>
            .
          </p>
        </div>

        <div className="card p-6 sm:p-8 space-y-3">
          <h2 className="font-display text-2xl text-brand-text tracking-wide">Aplikácia Mudrc post</h2>
          <p>
            Aplikácia Mudrc post zverejňuje oznamy o kvízoch na facebookovej stránke Mudrc kvíz
            (facebook.com/mudrc.sk), ktorú spravuje organizátor. Neprihlasuje návštevníkov webu, nečíta ich
            facebookové profily, správy ani zoznam priateľov.
          </p>
          <p>
            Do príspevku ide text o termíne, mieste a odkaz na stránku kvízu na mudrc.sk. Telefónne čísla tímov sa
            na Facebook nezverejňujú.
          </p>
        </div>

        <div className="card p-6 sm:p-8 space-y-3">
          <h2 className="font-display text-2xl text-brand-text tracking-wide">Cookies a meranie</h2>
          <p>
            Nevyhnutné cookies držia voľbu témy a súhlas s upozornením. Štatistiky a reklamné meranie (Google,
            Meta) bežia len po súhlase. Google Analytics 4 sa načíta až po povolení štatistík. Google Ireland
            Limited vtedy dostane adresu navštívenej stránky a technické údaje o prehliadači. Podrobnosti sú na{" "}
            <Link href="/cookies" className="text-brand-orange-readable hover:underline">
              stránke Cookies
            </Link>
            .
          </p>
        </div>

        <div className="card p-6 sm:p-8 space-y-3">
          <h2 className="font-display text-2xl text-brand-text tracking-wide">Vaše práva</h2>
          <p>
            Máte právo na prístup k údajom, ich opravu a vymazanie. Napíšte na kontakt@mudrc.sk a uveďte názov tímu
            a telefón, pod ktorým ste sa registrovali. Žiadosť vybavíme bez zbytočného odkladu.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-4 border-t border-brand-border">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-muted hover:text-brand-orange-readable transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Späť na úvod
          </Link>
          <a
            href="mailto:kontakt@mudrc.sk"
            className="btn-outline text-sm py-3 px-5 inline-flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Mail className="w-4 h-4" />
            kontakt@mudrc.sk
          </a>
        </div>
      </section>
    </div>
  );
}
