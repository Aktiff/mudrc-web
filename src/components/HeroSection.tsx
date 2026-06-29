"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-brand-bg">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/3"
        style={{ background: "radial-gradient(circle, rgba(240,180,41,0.08) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(240,180,41,0.04) 0%, transparent 70%)" }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="font-display text-6xl sm:text-7xl leading-none text-brand-text mb-6">
              OTESTUJTE<br /><span className="text-gradient">SVOJE</span><br />VEDOMOSTI<br />A ZAŽITE<br /><span className="text-gradient">KOPEC ZÁBAVY</span>
            </h1>
            <p className="text-brand-muted text-lg leading-relaxed mb-10 max-w-md">
              Zapojte sa do vedomostnej bitky s priateľmi priamo vo vašom obľúbenom podniku. Kvízy MUDRC spájajú napínavé otázky, skvelú partiu a atmosféru, kde sa vám z hlavy bude zaručene pariť.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/#kvizy" className="btn-primary text-base px-8 py-4">
                Najbližší kvíz <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/#ako-to-funguje" className="btn-outline text-base px-8 py-4">
                Ako to funguje?
              </Link>
            </div>
          </div>

          {/* Stats grid */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative w-full max-w-sm">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
                <span className="font-display text-[18rem] leading-none text-brand-orange opacity-[0.04]">?</span>
              </div>
              <div className="relative grid grid-cols-2 gap-4">
                <div className="bg-brand-card border border-brand-border rounded-2xl p-7 text-center shadow-sm">
                  <div className="font-display text-5xl text-brand-orange">3.</div>
                  <div className="text-brand-muted text-sm mt-2">sezóna</div>
                </div>
                <div className="bg-brand-orange rounded-2xl p-7 text-center shadow-sm">
                  <div className="font-display text-5xl text-brand-btn-fg">500+</div>
                  <div className="text-brand-btn-fg/70 text-sm mt-2">hráčov</div>
                </div>
                <div className="bg-brand-orange rounded-2xl p-7 text-center shadow-sm">
                  <div className="font-display text-5xl text-brand-btn-fg">8+</div>
                  <div className="text-brand-btn-fg/70 text-sm mt-2">podnikov</div>
                </div>
                <div className="bg-brand-card border border-brand-border rounded-2xl p-7 text-center shadow-sm">
                  <div className="font-display text-5xl text-brand-orange">55</div>
                  <div className="text-brand-muted text-sm mt-2">otázok / kvíz</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
