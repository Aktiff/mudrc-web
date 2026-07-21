/** Verejné ID — nastav v .env.local a vo Vercel Environment Variables. */

export function getGtmId(): string | null {
  const id = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  return id || null;
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(getGtmId());
}
