import Link from "next/link";

export default function HowItWorksSection() {
  return (
    <section id="ako-to-funguje" className="bg-brand-warm py-24 border-y border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">Jednoduchý postup</span>
          <h2 className="section-title mt-2">Ako funguje <span className="text-gradient">kvízový večer?</span></h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="relative">
            <div className="font-display text-8xl leading-none select-none text-brand-surface">01</div>
            <div className="-mt-6">
              <h3 className="font-display text-2xl text-brand-text mb-3">Vyberte si podnik</h3>
              <p className="text-brand-muted leading-relaxed text-sm">
                Pozrite si{" "}
                <Link href="/#kvizy" className="text-brand-orange-readable font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity">
                  zoznam podnikov
                </Link>
                , kde kvízy organizujeme, a vyberte si ten, ktorý máte najbližšie alebo najradšej.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="font-display text-8xl leading-none select-none text-brand-surface">02</div>
            <div className="-mt-6">
              <h3 className="font-display text-2xl text-brand-text mb-3">Zaregistrujte tím</h3>
              <p className="text-brand-muted leading-relaxed text-sm">
                Zložte partiu (čím viac ľudí – tým lepšie) a bezplatne si rezervujte stôl cez náš online formulár. Stačí zadať názov tímu a počet ľudí.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="font-display text-8xl leading-none select-none text-brand-surface">03</div>
            <div className="-mt-6">
              <h3 className="font-display text-2xl text-brand-text mb-3">Príďte a ukážte sa</h3>
              <p className="text-brand-muted leading-relaxed text-sm">
                V kľude sa usaďte, objednajte si drink a moderátor vás prevedie celým večerom. Čakajú vás vizuálne, zvukové aj textové hádanky.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="font-display text-8xl leading-none select-none text-brand-surface">04</div>
            <div className="-mt-6">
              <h3 className="font-display text-2xl text-brand-text mb-3">Zbierajte body do ligy</h3>
              <p className="text-brand-muted leading-relaxed text-sm">
                Každým kvízom bojujete nielen o okamžité ceny večera, ale aj o dôležité body do celosezónnej ligovej tabuľky o titul absolútnych MUDRCov.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
