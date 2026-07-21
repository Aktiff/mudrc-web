"use client";

import { useEffect, useState } from "react";
import {
  getConsentPreferences,
  hasConsentDecision,
  saveConsent,
  type ConsentPreferences,
} from "@/lib/cookie-consent";

export default function CookiePreferencesPanel() {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const prefs = getConsentPreferences();
    if (prefs) {
      setAnalytics(prefs.analytics);
      setMarketing(prefs.marketing);
    }
  }, []);

  const save = () => {
    const prefs: ConsentPreferences = {
      version: 2,
      necessary: true,
      analytics,
      marketing,
      decidedAt: new Date().toISOString(),
    };
    saveConsent(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const acceptAll = () => {
    saveConsent("all");
    setAnalytics(true);
    setMarketing(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="card p-6 sm:p-8 space-y-4" id="nastavenia">
      <h2 className="font-display text-2xl text-brand-text tracking-wide">Nastavenia súhlasu</h2>
      {!hasConsentDecision() && (
        <p className="text-brand-muted text-sm">Ešte ste nepotvrdili lištu — tu môžete rovno zvoliť preferencie.</p>
      )}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={analytics}
            onChange={(e) => setAnalytics(e.target.checked)}
            className="mt-1 rounded border-brand-border accent-brand-orange"
          />
          <span className="text-sm text-brand-muted">Štatistiky (GA4, Vercel Analytics, konverzie registrácií)</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-1 rounded border-brand-border accent-brand-orange"
          />
          <span className="text-sm text-brand-muted">Marketing (Google Ads, Meta Pixel, remarketing)</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <button type="button" onClick={save} className="btn-primary text-sm py-2.5 px-5">
          Uložiť výber
        </button>
        <button type="button" onClick={acceptAll} className="btn-outline text-sm py-2.5 px-4">
          Prijať všetko
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400 self-center">Uložené.</span>}
      </div>
    </div>
  );
}
