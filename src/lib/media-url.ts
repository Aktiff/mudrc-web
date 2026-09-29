import { absoluteUrl } from "@/lib/site-url";

/** URL ulozena v datach → src pre img (relativna /api/media/ alebo legacy absolutna). */
export function mediaUrlForBrowser(storedUrl: string | undefined): string | undefined {
  const trimmed = storedUrl?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/api/media/") || trimmed.startsWith("/uploads/")) return trimmed;
  return trimmed;
}

export function absoluteMediaUrl(storedUrl: string | undefined): string | undefined {
  const browser = mediaUrlForBrowser(storedUrl);
  if (!browser) return undefined;
  if (browser.startsWith("http://") || browser.startsWith("https://")) return browser;
  return absoluteUrl(browser);
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

/** URL pre `<audio>` / `<video>` — Supabase verejné linky idú cez proxy (402 / STORAGE_DISABLE). */
export function playbackMediaSrc(storedUrl: string | undefined): string | undefined {
  const trimmed = storedUrl?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/api/media/") || trimmed.startsWith("/uploads/")) return trimmed;
  if (isSupabaseUploadsUrl(trimmed)) {
    const objectPath = supabaseUploadsObjectPath(trimmed);
    if (objectPath) {
      return `/api/media/supabase/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
    }
  }
  return trimmed;
}
