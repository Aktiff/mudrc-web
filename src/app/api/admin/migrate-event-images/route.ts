import { NextResponse } from "next/server";
import { uploadBlobMedia } from "@/lib/blob-media";
import { isSupabaseUploadsUrl, supabaseUploadsObjectPath } from "@/lib/media-url";
import { readEvents, shouldWriteBlob, writeEvents } from "@/lib/storage";
import { hasSupabaseStorage } from "@/lib/supabase-storage";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guessImageContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function downloadImageBytes(url: string, objectPath: string | null): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }
  } catch {
    // fall through
  }

  if (!objectPath || !hasSupabaseStorage()) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.storage.from("uploads").download(objectPath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

export async function POST() {
  if (!shouldWriteBlob()) {
    return NextResponse.json({ ok: false, error: "Blob nie je nakonfigurovaný." }, { status: 503 });
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
    if (imageUrl.startsWith("/api/media/")) {
      skipped.push(event.slug);
      continue;
    }
    if (!isSupabaseUploadsUrl(imageUrl)) {
      skipped.push(event.slug);
      continue;
    }

    const objectPath = supabaseUploadsObjectPath(imageUrl);
    const fileName = objectPath?.split("/").pop() ?? `${event.slug}.jpg`;
    const buffer = await downloadImageBytes(imageUrl, objectPath);
    if (!buffer?.length) {
      failed.push({
        slug: event.slug,
        reason: "Supabase storage nedostupný (402) — nahraj fotku znova v admin → Udalosti.",
      });
      continue;
    }

    try {
      const folder = objectPath?.startsWith("events/") ? "events" : "events";
      const { url } = await uploadBlobMedia(folder, fileName, buffer, guessImageContentType(fileName));
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

  return NextResponse.json(
    {
      ok: failed.length === 0,
      migrated,
      skipped,
      failed,
      hint:
        failed.length > 0
          ? "Ak Supabase nejde stiahnuť, v admin → Udalosti otvor každý podnik a znova Nahraj fotku (upload ide do Blob)."
          : undefined,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
