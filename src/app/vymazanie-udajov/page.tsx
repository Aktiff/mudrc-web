import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Vymazanie údajov",
  description: "Ako požiadať Mudrc Kvíz o vymazanie údajov tímu a čo robí aplikácia Mudrc post.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-brand-bg pt-16">
      <section className="bg-brand-warm border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">
            Právne informácie
          </span>
          <h1 className="font-display text-5xl sm:text-6xl text-brand-text tracking-wide mt-3">
            VYMAZANIE ÚDAJOV
          </h1>
          <p className="text-brand-muted text-lg mt-4 leading-relaxed max-w-2xl">
            Údaje z registrácie na kvíz vymažeme na žiadosť. Napíšte na{" "}
            <a href="mailto:kontakt@mudrc.sk" className="text-brand-orange-readable hover:underline">
              kontakt@mudrc.sk
            </a>
            .
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8 text-brand-muted leading-relaxed">
        <div className="card p-6 sm:p-8 space-y-3">
          <h2 className="font-display text-2xl text-brand-text tracking-wide">Tím prihlásený na kvíz</h2>
          <p>Do e-mailu uveďte:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>názov tímu,</li>
            <li>telefónne číslo z registrácie,</li>
            <li>podnik a termín kvízu, ak ich viete,</li>
            <li>že žiadate o vymazanie údajov.</li>
          </ul>
          <p>
            Zmažeme registráciu aj uložený kontakt tímu. Potvrdenie pošleme na adresu, z ktorej žiadosť prišla.
          </p>
        </div>

        <div className="card p-6 sm:p-8 space-y-3">
          <h2 className="font-display text-2xl text-brand-text tracking-wide">Aplikácia Mudrc post</h2>
          <p>
            Aplikácia Mudrc post len zverejňuje oznamy na stránke Mudrc kvíz. Neukladá facebookové účty
            návštevníkov, ich správy ani zoznam priateľov. Osobné údaje, ktoré k vám držíme, sú len tie z
            registrácie tímu na mudrc.sk. Tie vymažeme rovnakým e-mailom na kontakt@mudrc.sk.
          </p>
        </div>

        <p className="text-sm">
          Viac o tom, čo ukladáme, je v{" "}
          <Link href="/ochrana-udajov" className="text-brand-orange-readable hover:underline">
            ochrane osobných údajov
          </Link>
          .
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-4 border-t border-brand-border">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-muted hover:text-brand-orange-readable transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Späť na úvod
          </Link>
          <a
            href="mailto:kontakt@mudrc.sk?subject=Vymazanie%20%C3%BAdajov"
            className="btn-outline text-sm py-3 px-5 inline-flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Mail className="w-4 h-4" />
            Požiadať o vymazanie
          </a>
        </div>
      </section>
    </div>
  );
}
