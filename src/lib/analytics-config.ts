/** Verejné ID kontajnera (viditeľné v HTML). Env môže prepísať pri testovaní. */
export const GTM_CONTAINER_ID = "GTM-PWN5FNDT";

export function getGtmId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  return fromEnv || GTM_CONTAINER_ID;
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(getGtmId());
}
