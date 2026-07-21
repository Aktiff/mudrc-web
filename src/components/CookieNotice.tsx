"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import {
  getConsentPreferences,
  hasConsentDecision,
  saveConsent,
  type ConsentPreferences,
} from "@/lib/cookie-consent";

export default function CookieNotice() {
  const pathname = usePathname();
  const onAdmin = pathname?.startsWith("/admin") ?? false;
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    if (onAdmin) return;
    if (!hasConsentDecision()) {
      setVisible(true);
      return;
    }
    const prefs = getConsentPreferences();
    if (prefs) {
      setAnalytics(prefs.analytics);
      setMarketing(prefs.marketing);
    }
  }, [onAdmin]);

  if (!visible || onAdmin) return null;

  const close = () => {
    setVisible(false);
    setShowSettings(false);
  };

  const acceptAll = () => {
    saveConsent("all");
    close();
  };

  const acceptNecessary = () => {
    saveConsent("necessary");
    close();
  };

  const saveCustom = () => {
    const prefs: ConsentPreferences = {
      version: 2,
      necessary: true,
      analytics,
      marketing,
      decidedAt: new Date().toISOString(),
    };
    saveConsent(prefs);
    close();
  };

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[110] p-4 sm:p-5 pointer-events-none"
      role="dialog"
      aria-labelledby="cookie-notice-title"
      aria-describedby="cookie-notice-desc"
    >
      <div className="pointer-events-auto max-w-4xl mx-auto bg-brand-card border border-brand-border rounded-2xl shadow-xl px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <p id="cookie-notice-title" className="font-semibold text-brand-text text-sm sm:text-base">
              Cookies a súkromie
            </p>
            <p id="cookie-notice-desc" className="text-brand-muted text-xs sm:text-sm mt-1 leading-relaxed">
              Nevyhnutné cookies sú vždy zapnuté (téma, fungovanie webu). Štatistiky a marketing (Google, Meta, PPC)
              zapneme len so súhlasom.{" "}
              <Link href="/cookies" className="text-brand-orange-readable font-medium hover:underline">
                Viac informácií
              </Link>
            </p>

            {showSettings && (
              <div className="mt-4 space-y-3 rounded-xl border border-brand-border bg-brand-surface/80 p-4">
                <label className="flex items-start gap-3 cursor-not-allowed opacity-80">
                  <input type="checkbox" checked disabled className="mt-1 rounded border-brand-border" />
                  <span>
                    <span className="block text-sm font-medium text-brand-text">Nevyhnutné</span>
                    <span className="block text-xs text-brand-muted mt-0.5">Téma, súhlas s lištou, zabezpečenie.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="mt-1 rounded border-brand-border accent-brand-orange"
                  />
                  <span>
                    <span className="block text-sm font-medium text-brand-text">Štatistiky</span>
                    <span className="block text-xs text-brand-muted mt-0.5">
                      Návštevnosť, konverzie registrácií, výkon webu (GA4, Vercel Analytics).
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="mt-1 rounded border-brand-border accent-brand-orange"
                  />
                  <span>
                    <span className="block text-sm font-medium text-brand-text">Marketing a reklama</span>
                    <span className="block text-xs text-brand-muted mt-0.5">
                      Meranie kampaní Google Ads, Meta (Facebook / Instagram), remarketing.
                    </span>
                  </span>
                </label>
                <button type="button" onClick={saveCustom} className="btn-primary text-sm py-2.5 px-4 w-full sm:w-auto">
                  Uložiť výber
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
            <button type="button" onClick={acceptAll} className="btn-primary text-sm py-2.5 px-5 w-full sm:w-auto">
              Prijať všetko
            </button>
            <button type="button" onClick={acceptNecessary} className="btn-outline text-sm py-2.5 px-4 w-full sm:w-auto">
              Len nevyhnutné
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-brand-muted hover:text-brand-text py-2 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              Nastavenia
              <ChevronDown className={`w-4 h-4 transition-transform ${showSettings ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
