export type CookieConsent = "accepted";

const STORAGE_KEY = "cookie-consent";

export function hasCookieConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "accepted";
}

export function setCookieConsent(value: CookieConsent): void {
  localStorage.setItem(STORAGE_KEY, value);
}
