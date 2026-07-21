import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, Mail, Megaphone, Moon, ShieldCheck, Trash2 } from "lucide-react";
import CookiePreferencesPanel from "@/components/CookiePreferencesPanel";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Informácie o cookies, súhlase a meraní na webe Mudrc Kvíz.",
};

const storedItems = [
  {
    icon: CheckCircle2,
    title: "Súhlas s upozornením",
    desc: "Zapamätáme, že ste si prečítali lištu o cookies.",
  },
  {
    icon: Moon,
    title: "Téma webu",
    desc: "Svetlý alebo tmavý režim podľa vášho výberu.",
  },
  {
    icon: BarChart3,
    title: "Štatistiky (voliteľné)",
    desc: "Po súhlase: návštevnosť, konverzie (registrácia tímu), výkon stránky — Google Analytics 4, Vercel Analytics.",
  },
  {
    icon: Megaphone,
    title: "Marketing (voliteľné)",
    desc: "Po súhlase: meranie reklám Google Ads, Meta (Facebook / Instagram), remarketing — spravuje sa cez Google Tag Manager.",
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
            Nevyhnutné cookies sú vždy zapnuté. Štatistiky a reklamné meranie (PPC) len so súhlasom — môžete kedykoľvek
            zmeniť výber nižšie.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
        <div className="card p-6 sm:p-8 flex gap-5 sm:gap-6 border-brand-orange/20 bg-gradient-to-br from-brand-card to-brand-tint/30">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand-tint flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7 text-brand-orange" />
          </div>
          <div>
            <h2 className="font-display text-2xl sm:text-3xl text-brand-text tracking-wide">Google Consent Mode</h2>
            <p className="text-brand-muted mt-3 leading-relaxed">
              Pred súhlasom neukladáme marketingové cookies. Po „Prijať všetko“ alebo vlastnom výbere sa zapnú len
              zvolené kategórie. Tagy (GA4, Google Ads, Meta Pixel) sa typicky spravujú v Google Tag Manageri — bez
              zbytočných úprav kódu pri každej kampani.
            </p>
          </div>
        </div>

        <CookiePreferencesPanel />

        <div>
          <h2 className="section-title text-2xl sm:text-3xl mb-6">Prehľad kategórií</h2>
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

        <div className="rounded-2xl border border-brand-border bg-brand-warm/50 px-6 py-5 sm:px-8 sm:py-6 flex gap-4">
          <Trash2 className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
          <p className="text-brand-muted text-sm sm:text-base leading-relaxed">
            <span className="font-medium text-brand-text">Vymazanie: </span>
            V prehliadači môžete zmazať cookies a údaje pre mudrc.sk. Lišta sa znova zobrazí a meranie sa vypne, kým
            znovu nesúhlasíte.
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
