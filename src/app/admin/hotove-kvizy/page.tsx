import HotoveKvizyList from "@/components/HotoveKvizyList";

export const dynamic = "force-dynamic";

export default function HotoveKvizyPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Hotové kvízy</h1>
        <p className="text-brand-muted text-sm max-w-2xl leading-relaxed">
          Knižnica otázok na recykláciu. Hore zapíšeš výsledok rovnako ako pri podniku — vyber podnik, kvíz, načítaj
          tímy do tabuľky a ulož body. Systém si pamätá kde, kedy a s kým kvíz hral.
        </p>
      </div>
      <HotoveKvizyList />
    </div>
  );
}
