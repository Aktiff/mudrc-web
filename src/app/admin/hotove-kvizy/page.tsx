import HotoveKvizyList from "@/components/HotoveKvizyList";

export const dynamic = "force-dynamic";

export default function HotoveKvizyPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Hotové kvízy</h1>
        <p className="text-brand-muted text-sm max-w-2xl leading-relaxed">
          Knižnica otázok na recykláciu. Pri zadávaní výsledkov vyberieš ktorý kvíz si použil — systém si pamätá kde,
          kedy a s akými tímami hral. Filtruj podľa nahlásených tímov, aby si neopakoval kvíz pre tímy, ktoré ho už mali.
        </p>
      </div>
      <HotoveKvizyList />
    </div>
  );
}
