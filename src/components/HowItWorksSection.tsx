import Link from "next/link";

const steps = [
  {
    num: "01",
    title: "Vyberte si podnik",
    desc: (
      <>
        Pozrite si{" "}
        <Link href="/#kvizy" className="text-brand-orange-readable font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity">
          zoznam podnikov
        </Link>
        , kde kvízy organizujeme, a vyberte si ten, ktorý máte najbližšie alebo najradšej.
      </>
    ),
  },
  {
    num: "02",
    title: "Zaregistrujte tím",
    desc: "Zložte partiu (čím viac ľudí – tým lepšie) a bezplatne si rezervujte stôl cez náš online formulár. Stačí zadať názov tímu a počet ľudí.",
  },
  {
    num: "03",
    title: "Príďte a ukážte sa",
    desc: "V kľude sa usaďte, objednajte si drink a moderátor vás prevedie celým večerom. Čakajú vás vizuálne, zvukové aj textové hádanky.",
  },
  {
    num: "04",
    title: "Zbierajte body do ligy",
    desc: "Každým kvízom bojujete nielen o okamžité ceny večera, ale aj o dôležité body do celosezónnej ligovej tabuľky o titul absolútnych MUDRCov.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="ako-to-funguje" className="bg-brand-warm py-16 sm:py-24 border-y border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">Jednoduchý postup</span>
          <h2 className="section-title mt-2">
            Ako funguje <span className="text-gradient">kvízový večer?</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
          {steps.map((step) => (
            <div key={step.num}>
              <div className="font-display text-7xl sm:text-8xl text-brand-border leading-none select-none">{step.num}</div>
              <div className="-mt-5 sm:-mt-6">
                <h3 className="font-display text-xl sm:text-2xl text-brand-text mb-2 sm:mb-3">{step.title}</h3>
                <p className="text-brand-muted leading-relaxed text-sm">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
