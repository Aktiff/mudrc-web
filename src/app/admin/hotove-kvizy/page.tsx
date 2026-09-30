import Link from "next/link";
import { BookOpen } from "lucide-react";
import HotoveKvizyList from "@/components/HotoveKvizyList";

export const dynamic = "force-dynamic";

export default function HotoveKvizyPage() {
  return (
    <div className="w-full">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 sm:gap-6">
        <div className="min-w-0">
          <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Kvízy</h1>
          <p className="text-brand-muted text-sm max-w-3xl leading-relaxed">
            Knižnica kvízov. Otvor kvíz, uprav otázky alebo ho prehraj na projektore.
          </p>
        </div>
        <div className="flex flex-col gap-3 shrink-0 self-start sm:mt-1">
          <Link
            href="/admin/hotove-kvizy/banka"
            className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Banka otázok
          </Link>
        </div>
      </div>
      <HotoveKvizyList />
    </div>
  );
}
