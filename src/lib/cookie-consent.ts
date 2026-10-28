export const CONSENT_STORAGE_KEY = "mudrc-cookie-consent";
const LEGACY_STORAGE_KEY = "cookie-consent";

/** Zvýšenie zahodí starú voľbu a lišta sa zobrazí znova. */
export const CONSENT_VERSION = 3;

export type ConsentPreferences = {
  version: typeof CONSENT_VERSION;
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
    if (data.version !== CONSENT_VERSION) return null;
    return {
      version: CONSENT_VERSION,
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

  return parseStored(localStorage.getItem(CONSENT_STORAGE_KEY));
}

export function hasConsentDecision(): boolean {
  return getConsentPreferences() !== null;
}

export function saveConsent(choice: ConsentChoice): ConsentPreferences {
  const prefs: ConsentPreferences =
    choice === "all"
      ? {
          version: CONSENT_VERSION,
          necessary: true,
          analytics: true,
          marketing: true,
          decidedAt: new Date().toISOString(),
        }
      : choice === "necessary"
        ? {
            version: CONSENT_VERSION,
            necessary: true,
            analytics: false,
            marketing: false,
            decidedAt: new Date().toISOString(),
          }
        : { ...choice, necessary: true, version: CONSENT_VERSION, decidedAt: choice.decidedAt ?? new Date().toISOString() };

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  applyGoogleConsent(prefs);
  clearWithdrawnCookies(prefs);
  window.dispatchEvent(new CustomEvent("mudrc-consent-change", { detail: prefs }));
  return prefs;
}

function expireCookie(name: string): void {
  const host = window.location.hostname.replace(/^www\./, "");
  const domains = ["", window.location.hostname, host, `.${host}`];
  for (const domain of domains) {
    const domainPart = domain ? `; domain=${domain}` : "";
    document.cookie = `${name}=; Max-Age=0; path=/${domainPart}`;
  }
}

/** Po odvolaní súhlasu zmaže už uložené meracie cookies. */
function clearWithdrawnCookies(prefs: ConsentPreferences): void {
  const names = document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);
  for (const name of names) {
    const analyticsCookie = name === "_ga" || name === "_gid" || name.startsWith("_ga_");
    const marketingCookie = name === "_fbp" || name === "_fbc" || name.startsWith("_gcl");
    if ((!prefs.analytics && analyticsCookie) || (!prefs.marketing && marketingCookie)) {
      expireCookie(name);
    }
  }
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
  if (raw) {
    var parsed = JSON.parse(raw);
    if (parsed && parsed.version === ${CONSENT_VERSION}) p = parsed;
  }
  if (!p && (raw || localStorage.getItem(legacy) === 'accepted')) {
    p = { analytics: false, marketing: false };
  }
  if (p) {
    gtag('consent', 'update', {
      'analytics_storage': p.analytics ? 'granted' : 'denied',
      'ad_storage': p.marketing ? 'granted' : 'denied',
      'ad_user_data': p.marketing ? 'granted' : 'denied',
      'ad_personalization': p.marketing ? 'granted' : 'denied'
    });
    if (!p.analytics || !p.marketing) {
      var host = location.hostname.replace(/^www\\./, '');
      document.cookie.split(';').forEach(function (part) {
        var name = part.trim().split('=')[0];
        var dropAnalytics = !p.analytics && (name === '_ga' || name === '_gid' || name.indexOf('_ga_') === 0);
        var dropMarketing = !p.marketing && (name === '_fbp' || name === '_fbc' || name.indexOf('_gcl') === 0);
        if (!dropAnalytics && !dropMarketing) return;
        ['', location.hostname, host, '.' + host].forEach(function (domain) {
          document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '');
        });
      });
    }
  }
} catch (e) {}
`.trim();
