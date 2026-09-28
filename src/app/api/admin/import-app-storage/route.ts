import { NextRequest, NextResponse } from "next/server";
import type { QuizEvent } from "@/lib/data";
import { writeAppStorageBlob } from "@/lib/blob-app-storage";
import { hasBlobStorage, persistEvents, shouldWriteBlob, writeBlob } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEGACY_EVENTS_KEY = "mudrc/events.json";
const LEGACY_REGS_KEY = "mudrc/registrations.json";

/**
 * Import Supabase `app_storage` (or export) rows into Vercel Blob.
 *
 * POST JSON body:
 * {
 *   "entries": {
 *     "events": { "events": [ ...QuizEvent ] },
 *     "registrations": { "registrations": [ ... ] },
 *     "quizzes": { "quizzes": [ ...StoredQuiz ] },
 *     "quiz-library-index": { "items": [ ... ] },
 *     "quiz-library-item-<id>": { ...QuizLibraryItem },
 *     "quiz-library:<id>": { ...QuizLibraryItem },
 *     "quiz-library": { "quizzes": [ ... ] },
 *     "custom-bank-questions" | "custom-bank": { "questions": [ ... ] },
 *     "sound-bank": { "clips": [ ... ] },
 *     "music-bank": { "tracks": [ ... ] },
 *     "video-bank": { "clips": [ ... ] },
 *     "quiz-decks": { "decks": [ ... ] },
 *     "seat-plans": { "plans": [ ... ] },
 *     "poll-configs": { "configs": [ ... ] },
 *     "poll-votes": { "votes": [ ... ] }
 *   }
 * }
 *
 * Blob paths:
 * - events / registrations → mudrc/events.json, mudrc/registrations.json
 * - ostatné kľúče → mudrc/app-storage/<key>.json (rovnaký názov ako Supabase `key`,
 *   okrem quiz-library-item-* a aliasu quiz-library:<id>)
 */
function normalizeImportKey(key: string): { target: "legacy-events" | "legacy-regs" | "app-blob"; blobName: string } {
  if (key === "events") return { target: "legacy-events", blobName: key };
  if (key === "registrations") return { target: "legacy-regs", blobName: key };
  if (key === "custom-bank") return { target: "app-blob", blobName: "custom-bank-questions" };
  if (key.startsWith("quiz-library:")) {
    const id = key.slice("quiz-library:".length);
    return { target: "app-blob", blobName: `quiz-library-item-${id}` };
  }
  return { target: "app-blob", blobName: key };
}

export async function POST(req: NextRequest) {
  if (!shouldWriteBlob()) {
    return NextResponse.json(
      {
        ok: false,
        error: "BLOB_READ_WRITE_TOKEN nie je nastavený — import do Blob nie je možný.",
        blobConfigured: hasBlobStorage(),
      },
      { status: 503 }
    );
  }

  let body: { entries?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatný JSON." }, { status: 400 });
  }

  const entries = body.entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return NextResponse.json({ ok: false, error: 'Očakávam objekt "entries".' }, { status: 400 });
  }

  const written: string[] = [];
  const errors: { key: string; message: string }[] = [];

  for (const [rawKey, value] of Object.entries(entries)) {
    if (value === undefined || value === null) continue;
    const key = rawKey.trim();
    if (!key) continue;

    try {
      const { target, blobName } = normalizeImportKey(key);
      if (target === "legacy-events") {
        const bundle = value as { events?: unknown[] };
        if (bundle?.events?.length) {
          await persistEvents(bundle.events as QuizEvent[]);
        } else {
          await writeBlob(LEGACY_EVENTS_KEY, value);
        }
      } else if (target === "legacy-regs") {
        await writeBlob(LEGACY_REGS_KEY, value);
      } else {
        await writeAppStorageBlob(blobName, value);
      }
      written.push(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ key, message });
    }
  }

  return NextResponse.json(
    {
      ok: errors.length === 0,
      written,
      errors,
      hint: "Po importe nastav STORAGE_DISABLE_SUPABASE=1 a redeploy; over cez /api/admin/storage-debug.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
