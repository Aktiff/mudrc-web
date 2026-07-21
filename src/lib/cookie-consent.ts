export const CONSENT_STORAGE_KEY = "mudrc-cookie-consent";
const LEGACY_STORAGE_KEY = "cookie-consent";

export type ConsentPreferences = {
  version: 2;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export type ConsentChoice = "all" | "necessary" | ConsentPreferences;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function parseStored(raw: string | null): ConsentPreferences | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<ConsentPreferences>;
    if (data.version !== 2) return null;
    return {
      version: 2,
      necessary: true,
      analytics: Boolean(data.analytics),
      marketing: Boolean(data.marketing),
      decidedAt: data.decidedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function getConsentPreferences(): ConsentPreferences | null {
  if (typeof window === "undefined") return null;

  const current = parseStored(localStorage.getItem(CONSENT_STORAGE_KEY));
  if (current) return current;

  if (localStorage.getItem(LEGACY_STORAGE_KEY) === "accepted") {
    return {
      version: 2,
      necessary: true,
      analytics: true,
      marketing: true,
      decidedAt: new Date().toISOString(),
    };
  }

  return null;
}

export function hasConsentDecision(): boolean {
  return getConsentPreferences() !== null;
}

export function saveConsent(choice: ConsentChoice): ConsentPreferences {
  const prefs: ConsentPreferences =
    choice === "all"
      ? {
          version: 2,
          necessary: true,
          analytics: true,
          marketing: true,
          decidedAt: new Date().toISOString(),
        }
      : choice === "necessary"
        ? {
            version: 2,
            necessary: true,
            analytics: false,
            marketing: false,
            decidedAt: new Date().toISOString(),
          }
        : { ...choice, necessary: true, version: 2, decidedAt: choice.decidedAt ?? new Date().toISOString() };

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  applyGoogleConsent(prefs);
  window.dispatchEvent(new CustomEvent("mudrc-consent-change", { detail: prefs }));
  return prefs;
}

export function applyGoogleConsent(prefs: ConsentPreferences): void {
  if (typeof window === "undefined") return;
  const gtag = window.gtag;
  if (!gtag) return;

  gtag("consent", "update", {
    analytics_storage: prefs.analytics ? "granted" : "denied",
    ad_storage: prefs.marketing ? "granted" : "denied",
    ad_user_data: prefs.marketing ? "granted" : "denied",
    ad_personalization: prefs.marketing ? "granted" : "denied",
  });
}

export function isAnalyticsAllowed(): boolean {
  return getConsentPreferences()?.analytics ?? false;
}

export function isMarketingAllowed(): boolean {
  return getConsentPreferences()?.marketing ?? false;
}

/** Inline telo pre Consent Mode — musí bežať pred GTM. */
export const CONSENT_BOOTSTRAP_SCRIPT = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;

gtag('consent', 'default', {
  'ad_storage': 'denied',
  'analytics_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'functionality_storage': 'granted',
  'security_storage': 'granted',
  'wait_for_update': 500
});

try {
  var key = '${CONSENT_STORAGE_KEY}';
  var legacy = '${LEGACY_STORAGE_KEY}';
  var raw = localStorage.getItem(key);
  var p = null;
  if (raw) { p = JSON.parse(raw); }
  else if (localStorage.getItem(legacy) === 'accepted') {
    p = { analytics: true, marketing: true };
  }
  if (p) {
    gtag('consent', 'update', {
      'analytics_storage': p.analytics ? 'granted' : 'denied',
      'ad_storage': p.marketing ? 'granted' : 'denied',
      'ad_user_data': p.marketing ? 'granted' : 'denied',
      'ad_personalization': p.marketing ? 'granted' : 'denied'
    });
  }
} catch (e) {}
`.trim();
