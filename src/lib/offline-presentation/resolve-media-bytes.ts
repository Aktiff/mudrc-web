import fs from "fs";
import path from "path";
import { BLOB_MEDIA_PREFIX, readBlobMediaBuffer } from "@/lib/blob-media";
import { absoluteUrl } from "@/lib/site-url";

export type MediaBytesResult =
  | { ok: true; data: Uint8Array; contentType?: string }
  | { ok: false; error: string };

function localUploadCandidates(urlPath: string): string[] {
  const relative = urlPath.replace(/^\/+/, "");
  return [
    path.join(process.cwd(), "public", relative),
    path.join(process.cwd(), "src", "data", relative),
    path.join(process.cwd(), relative),
  ];
}

function guessContentType(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
  };
  return map[ext];
}

async function readLocalIfExists(urlPath: string): Promise<MediaBytesResult | null> {
  for (const candidate of localUploadCandidates(urlPath)) {
    try {
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
      const data = fs.readFileSync(candidate);
      return { ok: true, data: new Uint8Array(data), contentType: guessContentType(candidate) };
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Load media bytes for an app-relative or absolute URL while packaging offline. */
export async function resolveMediaBytes(src: string, cookieHeader?: string): Promise<MediaBytesResult> {
  const trimmed = src.trim();
  if (!trimmed) return { ok: false, error: "Prázdna URL média." };

  if (trimmed.startsWith("/api/media/") && !trimmed.includes("/api/media/supabase/")) {
    const sub = trimmed
      .slice("/api/media/".length)
      .split("/")
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      })
      .join("/");
    try {
      const data = await readBlobMediaBuffer(`${BLOB_MEDIA_PREFIX}${sub}`);
      return { ok: true, data: new Uint8Array(data), contentType: guessContentType(sub) };
    } catch (error) {
      const local = await readLocalIfExists(`uploads/${sub}`);
      if (local) return local;
      return {
        ok: false,
        error: error instanceof Error ? error.message : `Médium sa nepodarilo načítať: ${trimmed}`,
      };
    }
  }

  if (trimmed.startsWith("/uploads/")) {
    const local = await readLocalIfExists(trimmed);
    if (local) return local;
    return { ok: false, error: `Lokálny súbor sa nenašiel: ${trimmed}` };
  }

  if (trimmed.startsWith("/api/media/supabase/")) {
    return {
      ok: false,
      error: `Médium už nie je v úložisku (starý odkaz). Nahraj ho znova v adminovi: ${trimmed}`,
    };
  }

  const absolute =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : trimmed.startsWith("/")
        ? absoluteUrl(trimmed)
        : trimmed;

  if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) {
    return { ok: false, error: `Nepodporovaná URL média: ${trimmed}` };
  }

  try {
    const headers: HeadersInit = {};
    if (cookieHeader && absolute.includes("/api/")) {
      headers.cookie = cookieHeader;
    }
    const response = await fetch(absolute, {
      headers,
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status} pre ${trimmed}` };
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    return {
      ok: true,
      data: buffer,
      contentType: response.headers.get("content-type") ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Sieťová chyba pri ${trimmed}`,
    };
  }
}
