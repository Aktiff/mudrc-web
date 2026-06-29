import { ArrowRight } from "lucide-react";

const roles = [
  {
    title: "Moderátor / moderátorka",
    desc: "Vedieš kvízy, komunikuješ s publikom, staráš sa o hladký priebeh celej akcie.",
  },
  {
    title: "Tvorca otázok",
    desc: "Vymýšľaš zaujímavé otázky a kategórie. Testuješ obľúbené témy a novinky.",
  },
];

export default function CareerSection() {
  return (
    <section id="kariera" className="bg-brand-warm border-t border-brand-border py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">Pridaj sa k nám</span>
            <h2 className="section-title mt-2">
              Pracuj s nami
            </h2>
            <p className="text-brand-muted text-lg leading-relaxed mt-6">
              Hľadáme šikovných ľudí, ktorí majú radi zábavu a vedomostné súťaže. Ponúkame flexibilnú prácu a skvelý tím.
            </p>
          </div>
          <div className="space-y-4">
            {roles.map((role) => (
              <a
                key={role.title}
                href="mailto:kontakt@mudrc.sk"
                target="_blank"
                rel="noopener noreferrer"
                className="card p-6 flex items-center justify-between gap-4 group block hover:bg-brand-tint"
              >
                <div>
                  <h3 className="font-semibold text-brand-text text-lg">{role.title}</h3>
                  <p className="text-brand-muted text-sm mt-1">{role.desc}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-brand-orange shrink-0 group-hover:translate-x-1 transition-transform" />
              </a>
            ))}
            <a href="mailto:kontakt@mudrc.sk" target="_blank" rel="noopener noreferrer" className="btn-primary w-full justify-center text-sm py-3 mt-4 inline-flex">
              Napíš nám
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
