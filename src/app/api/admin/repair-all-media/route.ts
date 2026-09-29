import { NextResponse } from "next/server";
import { migrateEventImagesToBlob } from "@/lib/media-migrate-events";
import { migrateQuizMediaToBlob } from "@/lib/media-migrate-quiz";
import { runRepairQuizMedia } from "@/lib/repair-quiz-media-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jedna oprava: fotky podnikov + ukážky v kvízoch/bankách. */
export async function POST() {
  const probe = await runRepairQuizMedia({ probeOnly: true });
  const eventImages = await migrateEventImagesToBlob();
  const quizBlob = await migrateQuizMediaToBlob();
  const repair = await runRepairQuizMedia({ copyToBlob: true });

  const ok = eventImages.ok !== false && quizBlob.ok !== false && repair.ok !== false;

  return NextResponse.json(
    {
      ok,
      probe,
      eventImages,
      quizBlobMigrate: quizBlob,
      quizRepair: repair,
      hint: ok
        ? "Obnov stránku (Ctrl+F5). Obrázky s /api/media/events/ a ukážky s /api/media/audio/ by mali ísť."
        : "Čo zlyhalo v „failed“, Supabase už nevracia — v admin znova Nahraj fotku / MP3 (~30 s).",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
