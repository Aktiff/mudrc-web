import type { Metadata } from "next";
import { LigaList } from "@/components/LigaList";

export const metadata: Metadata = {
  title: "Liga",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LigaPage() {
  return (
    <div className="min-h-screen bg-brand-bg pt-16">
      <section className="bg-brand-warm border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">
            Sezóna 2025 / 2026
          </span>
          <h1 className="font-display text-6xl sm:text-7xl text-brand-text tracking-wide mt-3">LIGA</h1>
          <p className="text-brand-muted text-lg mt-3 max-w-xl">
            Vyber podnik a uvidíš históriu kvízov a ligovú tabuľku. Zbieraj body, bojuj o prvé miesto.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <LigaList />
      </section>
    </div>
  );
}
