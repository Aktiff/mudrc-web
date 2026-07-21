import { isAnalyticsAllowed, isMarketingAllowed } from "@/lib/cookie-consent";

export type AnalyticsEventParams = Record<string, string | number | boolean | undefined>;

function pushDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const layer = (window.dataLayer ?? []) as Record<string, unknown>[];
  window.dataLayer = layer;
  layer.push(payload);
}

/** Udalosť pre GTM (konverzie, PPC, remarketing). */
export function trackEvent(event: string, params?: AnalyticsEventParams): void {
  if (typeof window === "undefined") return;
  if (!isAnalyticsAllowed() && !isMarketingAllowed()) return;

  pushDataLayer({
    event,
    ...params,
  });
}

/** Registrácia tímu — v GTM nastav trigger + konverziu (Google Ads / Meta). */
export function trackRegistrationComplete(payload: {
  eventSlug: string;
  venue: string;
  players?: number;
}): void {
  trackEvent("registration_complete", {
    event_slug: payload.eventSlug,
    venue: payload.venue,
    players: payload.players,
  });
}

/** Zobrazenie detailu kvízu — remarketing / custom audiences. */
export function trackViewQuiz(payload: { eventSlug: string; venue: string }): void {
  trackEvent("view_quiz", {
    event_slug: payload.eventSlug,
    venue: payload.venue,
  });
}

/** Kontakt / CTA — napr. Pre podniky. */
export function trackContactIntent(source: string): void {
  trackEvent("contact_intent", { source });
}
