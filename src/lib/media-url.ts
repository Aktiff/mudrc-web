import { absoluteUrl } from "@/lib/site-url";

function supabaseProxyPath(objectPath: string): string {
  return `/api/media/supabase/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
}

export function supabaseUploadsObjectPath(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/uploads\/([^?#]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function isSupabaseUploadsUrl(url: string): boolean {
  return url.includes(".supabase.co/storage/") && url.includes("/uploads/");
}

/**
 * Uložená URL → src pre img/audio/video.
 * Supabase a legacy /uploads/ idú cez /api/media/supabase/… (402, STORAGE_DISABLE).
 */
export function resolveMediaSrc(storedUrl: string | undefined): string | undefined {
  const trimmed = storedUrl?.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("/api/media/")) return trimmed;

  if (trimmed.startsWith("/uploads/")) {
    const sub = trimmed.replace(/^\/uploads\//, "");
    return supabaseProxyPath(sub);
  }

  if (/^(audio|video|events|images)\/[^/]+/.test(trimmed)) {
    return supabaseProxyPath(trimmed);
  }

  if (isSupabaseUploadsUrl(trimmed)) {
    const objectPath = supabaseUploadsObjectPath(trimmed);
    if (objectPath) return supabaseProxyPath(objectPath);
  }

  return trimmed;
}

/** @deprecated Použi resolveMediaSrc — zachované pre existujúce importy. */
export function mediaUrlForBrowser(storedUrl: string | undefined): string | undefined {
  return resolveMediaSrc(storedUrl);
}

export function playbackMediaSrc(storedUrl: string | undefined): string | undefined {
  return resolveMediaSrc(storedUrl);
}

export function absoluteMediaUrl(storedUrl: string | undefined): string | undefined {
  const browser = resolveMediaSrc(storedUrl);
  if (!browser) return undefined;
  if (browser.startsWith("http://") || browser.startsWith("https://")) return browser;
  return absoluteUrl(browser);
}

export function rewriteStoredMediaUrl(url: string | undefined): string | undefined {
  return resolveMediaSrc(url);
}
