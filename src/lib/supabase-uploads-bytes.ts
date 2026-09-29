import { createClient } from "@supabase/supabase-js";
import { guessAudioContentType } from "@/lib/audio-upload";
import { guessVideoContentType } from "@/lib/video-upload";
import { hasSupabaseStorage } from "@/lib/supabase-storage";

function guessContentType(objectPath: string): string {
  const name = objectPath.split("/").pop() ?? "file.bin";
  if (objectPath.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(name)) {
    return guessVideoContentType(name, "");
  }
  if (objectPath.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|aac)$/i.test(name)) {
    return guessAudioContentType(name, "");
  }
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function publicUploadsUrl(objectPath: string): string | null {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  const encoded = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base}/storage/v1/object/public/uploads/${encoded}`;
}

/** Stiahne súbor z bucketu uploads (verejná URL, potom service role). */
export async function fetchSupabaseUploadsBytes(
  objectPath: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const normalized = objectPath.replace(/^\/+/, "").trim();
  if (!normalized || normalized.includes("..")) return null;

  const publicUrl = publicUploadsUrl(normalized);
  if (publicUrl) {
    try {
      const res = await fetch(publicUrl, { cache: "no-store" });
      if (res.ok) {
        return {
          buffer: Buffer.from(await res.arrayBuffer()),
          contentType: res.headers.get("content-type") || guessContentType(normalized),
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (!hasSupabaseStorage()) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.storage.from("uploads").download(normalized);
    if (error || !data) return null;
    return {
      buffer: Buffer.from(await data.arrayBuffer()),
      contentType: guessContentType(normalized),
    };
  } catch {
    return null;
  }
}
