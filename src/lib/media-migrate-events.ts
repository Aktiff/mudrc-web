import { isSupabaseUploadsUrl, supabaseUploadsObjectPath } from "@/lib/media-url";
import { readEvents, shouldWriteBlob, writeEvents } from "@/lib/storage";

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

    failed.push({
      slug: event.slug,
      reason: "Stará fotka už nie je v úložisku. Nahraj ju znova v admin → Udalosti.",
    });
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
