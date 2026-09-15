import Link from "next/link";
import { BookOpen } from "lucide-react";
import HotoveKvizyList from "@/components/HotoveKvizyList";

export const dynamic = "force-dynamic";

export default function HotoveKvizyPage() {
  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Hotové kvízy</h1>
          <p className="text-brand-muted text-sm max-w-3xl leading-relaxed">
            Knižnica otázok na recykláciu. Hore zapíšeš výsledok rovnako ako pri podniku — vyber podnik, kvíz, načítaj
            tímy do tabuľky a ulož body. Systém si pamätá kde, kedy a s kým kvíz hral.
          </p>
        </div>
        <Link
          href="/admin/hotove-kvizy/banka"
          className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2 shrink-0 self-start"
        >
          <BookOpen className="w-4 h-4" />
          Banka otázok
        </Link>
      </div>
      <HotoveKvizyList />
    </div>
  );
}
