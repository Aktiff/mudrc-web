import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardList, Mail, Moon, ShieldCheck, Trash2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Informácie o cookies a ukladaní údajov na webe Mudrc Kvíz.",
};

const storedItems = [
  {
    icon: CheckCircle2,
    title: "Súhlas s upozornením",
    desc: "Po kliknutí na „Súhlasím“ si prehliadač zapamätá, že ste lištu videli — neukazuje sa stále dokola.",
  },
  {
    icon: Moon,
    title: "Svetlá alebo tmavá téma",
    desc: "Váš výber v hlavičke stránky si prehliadač uloží, aby ste nemuseli prepínať pri každej návšteve.",
  },
];

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-brand-bg pt-16">
      <section className="bg-brand-warm border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">
            Právne informácie
          </span>
          <h1 className="font-display text-5xl sm:text-6xl text-brand-text tracking-wide mt-3">COOKIES</h1>
          <p className="text-brand-muted text-lg mt-4 leading-relaxed max-w-2xl">
            Ako mudrc.sk pracuje s cookies a údajmi v prehliadači. Bez reklamného sledovania, len to nevyhnutné pre
            pohodlné používanie webu.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
        <div className="card p-6 sm:p-8 flex gap-5 sm:gap-6 border-brand-orange/20 bg-gradient-to-br from-brand-card to-brand-tint/30">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand-tint flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7 text-brand-orange" />
          </div>
          <div>
            <h2 className="font-display text-2xl sm:text-3xl text-brand-text tracking-wide">Bez sledovacích cookies</h2>
            <p className="text-brand-muted mt-3 leading-relaxed">
              Nepoužívame Google Analytics, reklamné pixely ani iné nástroje, ktoré by vás sledovali po webe. Na
              mudrc.sk nepredávame vaše správanie tretím stranám.
            </p>
          </div>
        </div>

        <div>
          <h2 className="section-title text-2xl sm:text-3xl mb-6">Čo sa u vás môže uložiť</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {storedItems.map((item) => (
              <div key={item.title} className="card p-6 sm:p-7 h-full">
                <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-brand-orange" />
                </div>
                <h3 className="font-semibold text-brand-text text-lg mb-2">{item.title}</h3>
                <p className="text-brand-muted text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6 sm:p-8 flex gap-5">
          <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-brand-orange" />
          </div>
          <div>
            <h2 className="font-semibold text-brand-text text-lg mb-2">Registrácia na kvíz</h2>
            <p className="text-brand-muted text-sm sm:text-base leading-relaxed">
              Meno tímu a kontakt z formulára posielame na náš server kvôli organizácii večera — to nie sú cookies v
              prehliadači. Pri registrácii vás informujeme o spracovaní údajov; pri otázkach nás kontaktujte.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-border bg-brand-warm/50 px-6 py-5 sm:px-8 sm:py-6 flex gap-4">
          <Trash2 className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
          <p className="text-brand-muted text-sm sm:text-base leading-relaxed">
            <span className="font-medium text-brand-text">Vymazanie údajov: </span>
            V nastaveniach prehliadača môžete zmazať cookies a údaje pre mudrc.sk. Lišta o cookies sa môže znova
            zobraziť a tému si zvolíte odznova.
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
