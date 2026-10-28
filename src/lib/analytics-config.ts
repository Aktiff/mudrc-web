/** Verejné ID kontajnera (viditeľné v HTML). Env môže prepísať pri testovaní. */
export const GTM_CONTAINER_ID = "GTM-PWN5FNDT";

/** GA4 Measurement ID property Mudrc. Env môže prepísať pri testovaní. */
export const GA_MEASUREMENT_ID = "G-07TMVBTV1G";

export function getGtmId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  return fromEnv || GTM_CONTAINER_ID;
}

export function getGaMeasurementId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return fromEnv || GA_MEASUREMENT_ID;
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(getGtmId());
}
