import { uploadBlobMedia } from "@/lib/blob-media";
import { isSupabaseUploadsUrl, supabaseUploadsObjectPath } from "@/lib/media-url";
import { fetchSupabaseUploadsBytes } from "@/lib/supabase-uploads-bytes";
import { readEvents, shouldWriteBlob, writeEvents } from "@/lib/storage";

function guessImageContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export async function migrateEventImagesToBlob() {
  if (!shouldWriteBlob()) {
    return { ok: false as const, error: "Blob nie je nakonfigurovaný." };
  }

  const { events } = await readEvents();
  const migrated: string[] = [];
  const skipped: string[] = [];
  const failed: { slug: string; reason: string }[] = [];

  const nextEvents = structuredClone(events);

  for (const event of nextEvents) {
    const imageUrl = event.imageUrl?.trim();
    if (!imageUrl) {
      skipped.push(event.slug);
      continue;
    }
    if (imageUrl.startsWith("/api/media/") && !imageUrl.includes("/api/media/supabase/")) {
      skipped.push(event.slug);
      continue;
    }

    let objectPath = supabaseUploadsObjectPath(imageUrl);
    if (!objectPath && imageUrl.startsWith("/api/media/supabase/")) {
      objectPath = imageUrl
        .replace(/^\/api\/media\/supabase\//, "")
        .split("/")
        .map((p) => decodeURIComponent(p))
        .join("/");
    }
    if (!objectPath && isSupabaseUploadsUrl(imageUrl)) {
      objectPath = supabaseUploadsObjectPath(imageUrl);
    }
    if (!objectPath) {
      skipped.push(event.slug);
      continue;
    }

    const fileName = objectPath.split("/").pop() ?? `${event.slug}.jpg`;
    const file = await fetchSupabaseUploadsBytes(objectPath);
    if (!file?.buffer.length) {
      failed.push({
        slug: event.slug,
        reason: "Supabase storage nedostupný — nahraj fotku znova v admin → Udalosti.",
      });
      continue;
    }

    try {
      const { url } = await uploadBlobMedia("events", fileName, file.buffer, guessImageContentType(fileName));
      event.imageUrl = url;
      migrated.push(event.slug);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ slug: event.slug, reason: message });
    }
  }

  if (migrated.length > 0) {
    await writeEvents({ events: nextEvents });
  }

  return {
    ok: failed.length === 0,
    migrated,
    skipped,
    failed,
  };
}
