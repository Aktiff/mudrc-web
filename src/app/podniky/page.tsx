import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, BarChart2, RefreshCw, TrendingUp, Megaphone, Tv, Users, Mic, FileText, Volume2, Share2, Trophy, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Pre podniky",
};

const steps = [
  {
    num: "01",
    title: "Nezáväzný kontakt",
    desc: "Napíšte nám alebo zavolajte. Preberieme vaše predstavy a základné možnosti priestoru.",
  },
  {
    num: "02",
    title: "Obhliadka priestoru",
    desc: "Osobne sa stretneme priamo u vás. Pozrieme sa na kapacitu stolov, rozmiestnenie a technické riešenie podniku.",
  },
  {
    num: "03",
    title: "Výber ideálneho dňa",
    desc: "Nájdeme vhodný termín – ideálne deň v týždni (napr. utorok až štvrtok), kedy bežne potrebujete zvýšiť tržby a naplniť stoly.",
  },
  {
    num: "04",
    title: "Realizácia kvízu",
    desc: "Prinesieme moderátora, techniku, otázky a postaráme sa o propagáciu. Celý večer odmoderujeme a vy sa sústredíte len na obsluhu hostí.",
  },
];

const benefits = [
  {
    icon: BarChart2,
    title: "Plné stoly aj cez týždeň",
    desc: "Kvízy organizujeme v dňoch, kedy reštaurácie a bary bežne zívajú prázdnotou. Prinesieme vám novú vlnu zákazníkov.",
  },
  {
    icon: RefreshCw,
    title: "Pravidelne sa vracajúci hostia",
    desc: "Naša kvízová liga tímy baví a motivuje. Budú sa k vám pravidelne každé dva týždne vracať, aby bojovali o body v tabuľke.",
  },
  {
    icon: TrendingUp,
    title: "Vyššie tržby na bare a v kuchyni",
    desc: "Hráči počas 2 až 3 hodín kvízu neustále konzumujú. Výrazne tak stúpne obrat z nápojov aj jedla.",
  },
  {
    icon: Megaphone,
    title: "Reklama pre váš podnik",
    desc: "Vďaka našej propagácii na sociálnych sieťach dostaneme váš podnik do povedomia nových ľudí z okolia.",
  },
];

const weNeed = [
  { icon: Tv, text: "TV alebo projektor – viditeľný pre väčšinu stolov na premietanie kvízových otázok." },
  { icon: Users, text: "Kapacitu pre stoly – ideálne priestor pre minimálne 5 až 10 tímov (cca 20 až 50 ľudí)." },
];

const weBring = [
  { icon: Mic, text: "Skúseného moderátora / moderátorku, ktorí sa postarajú o skvelú atmosféru." },
  { icon: FileText, text: "Originálne kvízové otázky (témy od histórie po popkultúru, audio a vizuálne hádanky)." },
  { icon: Volume2, text: "Profesionálne ozvučenie a kompletné technické zabezpečenie." },
  { icon: Share2, text: "Marketingovú podporu a správu online registrácií pre váš podnik." },
  { icon: Trophy, text: "Vedenie ligovej tabuľky a kompletný servis okolo hráčov." },
];

export default function PodnikyPage() {
  return (
    <div className="min-h-screen bg-brand-bg pt-16">

      {/* Hero */}
      <section className="bg-brand-warm border-b border-brand-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">
            Pre podniky a reštaurácie
          </span>
          <h1 className="font-display text-5xl sm:text-6xl text-brand-text tracking-wide mt-4 mb-6 leading-tight">
            Chcete mať plný podnik<br />
            <span className="text-gradient">aj počas slabších dní v týždni?</span>
          </h1>
          <p className="text-brand-muted text-lg max-w-2xl mx-auto leading-relaxed mb-10">
            Prineste do svojho podniku pravidelnú vedomostnú zábavu pod značkou MUDRC. Postaráme sa o kompletnú organizáciu a dotiahneme k vám desiatky platiacich hostí. Vy len otvorte dvere a zabezpečte servis na bare.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="mailto:kontakt@mudrc.sk" className="btn-primary text-base px-8 py-4">
              <Mail className="w-5 h-5" />
              Chcem hostiť kvíz
            </a>
            <a href="tel:+421951457439" className="btn-outline text-base px-8 py-4">
              <Phone className="w-5 h-5" />
              Zavolajte nám
            </a>
          </div>
        </div>
      </section>

      {/* Postup */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">Postup</span>
          <h2 className="section-title mt-2">Spolupráca, ktorá vás nezaťaží</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {steps.map((step) => (
            <div key={step.num}>
              <div className="font-display text-8xl text-brand-border leading-none select-none">{step.num}</div>
              <div className="-mt-6">
                <h3 className="font-display text-2xl text-brand-text mb-3">{step.title}</h3>
                <p className="text-brand-muted leading-relaxed text-sm">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefity */}
      <section className="bg-brand-warm border-y border-brand-border py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">Prečo áno?</span>
            <h2 className="section-title mt-2">Prečo spolupracovať s kvízom MUDRC?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="card p-8 flex gap-5">
                <div className="w-12 h-12 rounded-2xl bg-brand-tint flex items-center justify-center shrink-0">
                  <b.icon className="w-6 h-6 text-brand-orange" />
                </div>
                <div>
                  <h3 className="font-semibold text-brand-text text-lg mb-2">{b.title}</h3>
                  <p className="text-brand-muted text-sm leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Co potrebujeme / co prinesieme */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card p-8">
            <h3 className="font-display text-3xl text-brand-text tracking-wide mb-6">
              Čo potrebujeme od vás
            </h3>
            <ul className="space-y-5">
              {weNeed.map((r) => (
                <li key={r.text} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0 mt-0.5">
                    <r.icon className="w-5 h-5 text-brand-orange" />
                  </div>
                  <span className="text-brand-muted leading-relaxed pt-2">{r.text}</span>
                </li>
              ))}
            </ul>
            <p className="text-brand-muted-light text-sm mt-8 pt-6 border-t border-brand-border italic">
              To je naozaj všetko. Zvyšok riešime my.
            </p>
          </div>
          <div className="card p-8">
            <h3 className="font-display text-3xl text-brand-text tracking-wide mb-6">
              Čo prinesieme my
            </h3>
            <ul className="space-y-4">
              {weBring.map((item) => (
                <li key={item.text} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="w-5 h-5 text-brand-orange" />
                  </div>
                  <span className="text-brand-muted leading-relaxed pt-2">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Vstupné a ceny */}
      <section className="bg-brand-warm border-y border-brand-border py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">Financie</span>
            <h2 className="font-display text-4xl sm:text-5xl text-brand-text tracking-wide mt-3">
              Jasné a transparentné podmienky
            </h2>
          </div>
          <p className="text-brand-muted text-lg leading-relaxed mb-8 text-center">
            Za organizáciu kvízu nám neplatíte žiadne fixné poplatky ani provízie z vašich tržieb. Celých 100 % z obratu na bare a v kuchyni zostáva vám.
          </p>
          <div className="bg-brand-surface rounded-2xl border border-brand-border p-8">
            <p className="text-brand-text font-semibold mb-4">
              Jediné vaše náklady na kvízový večer sú:
            </p>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0 mt-0.5">
                <Trophy className="w-5 h-5 text-brand-orange" />
              </div>
              <p className="text-brand-muted leading-relaxed pt-2">
                <strong className="text-brand-text">Ceny pre víťazné tímy: </strong>
                Od podniku sa očakáva zabezpečenie drobných cien pre prvé tri miesta (napr. konzumné na bar v hodnote 15–20 €, fľaša alkoholu alebo drobnosť z kuchyne), ktoré slúžia ako motivácia pre hráčov.
              </p>
            </div>
            <p className="text-brand-muted text-sm leading-relaxed mt-6 pt-6 border-t border-brand-border">
              Náš moderátor následne na mieste vyberá od hráčov štandardné štartovné (typicky 4 € na osobu), z ktorého kompletne financujeme prípravu kvízov, techniku a personál. Celá akcia je pre vás bez finančného rizika.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-28 text-center">
        <h2 className="font-display text-4xl sm:text-5xl text-brand-text tracking-wide mb-4">
          Chcete premeniť prázdne stoly<br />
          <span className="text-gradient">na plný dom?</span>
        </h2>
        <p className="text-brand-muted text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          Prvá obhliadka priestoru a konzultácia je úplne bezplatná a nezáväzná. Dajte nám vedieť a prídeme sa pozrieť, ako môžeme nakopnúť tržby vo vašom podniku.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mb-10">
          <a href="mailto:kontakt@mudrc.sk" className="btn-primary text-base px-10 py-4">
            <Mail className="w-5 h-5" />
            kontakt@mudrc.sk
          </a>
          <a href="tel:+421951457439" className="btn-outline text-base px-10 py-4">
            <Phone className="w-5 h-5" />
            +421 951 457 439
          </a>
        </div>
        <Link href="/" className="text-brand-muted hover:text-brand-orange transition-colors text-sm">
          ← Späť na hlavnú stránku
        </Link>
      </section>

    </div>
  );
}
