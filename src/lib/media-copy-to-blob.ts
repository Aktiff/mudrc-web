import { uploadBlobMedia } from "@/lib/blob-media";
import { isSupabaseUploadsUrl, rewriteStoredMediaUrl } from "@/lib/media-url";
import { shouldWriteBlob } from "@/lib/storage";
import { fetchSupabaseUploadsBytes } from "@/lib/supabase-uploads-bytes";

function folderForPath(objectPath: string): "audio" | "video" | "events" | "images" {
  if (objectPath.startsWith("video/")) return "video";
  if (objectPath.startsWith("audio/")) return "audio";
  if (objectPath.startsWith("events/")) return "events";
  return "images";
}

/** Supabase / proxy URL → Blob (/api/media/…). Ak stiahnutie zlyhá, aspoň proxy URL. */
export async function copyOrRewriteMediaUrl(url: string | undefined): Promise<string | undefined> {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/api/media/") && !trimmed.includes("/api/media/supabase/")) {
    return trimmed;
  }

  const rewritten = rewriteStoredMediaUrl(trimmed) ?? trimmed;
  if (!rewritten.startsWith("/api/media/supabase/")) {
    return rewritten;
  }
  if (!shouldWriteBlob()) return rewritten;

  const objectPath = rewritten
    .replace(/^\/api\/media\/supabase\//, "")
    .split("/")
    .map((p) => decodeURIComponent(p))
    .join("/");
  const file = await fetchSupabaseUploadsBytes(objectPath);
  if (!file?.buffer.length) {
    return rewritten;
  }

  const fileName = objectPath.split("/").pop() ?? "file.bin";
  const folder = folderForPath(objectPath);
  const { url: blobUrl } = await uploadBlobMedia(folder, fileName, file.buffer, file.contentType);
  return blobUrl;
}

export function mediaUrlNeedsRepair(url: string | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/api/media/") && !trimmed.includes("/api/media/supabase/")) return false;
  return isSupabaseUploadsUrl(trimmed) || trimmed.startsWith("/api/media/supabase/") || trimmed.startsWith("/uploads/");
}
