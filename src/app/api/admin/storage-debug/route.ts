import { NextResponse } from "next/server";
import { countAppStorageBlobKeys } from "@/lib/blob-app-storage";
import { normalizeDateKey } from "@/lib/quiz-result-key";
import { getPollStorageSummary } from "@/lib/poll-storage";
import {
  getStorageDiagnostics,
  hasBlobStorage,
  readAllStoredQuizzes,
  readEvents,
  readRegistrations,
  readStoredQuiz,
} from "@/lib/storage";
import { getRegistrationEmailDiagnostics } from "@/lib/registration-email";
import {
  canUseSupabaseStorage,
  hasSupabaseStorage,
  supabaseFetchEvents,
  supabaseFetchQuizzes,
} from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const quizDate = url.searchParams.get("date");

  try {
    const { events } = await readEvents();
    const diagnostics = getStorageDiagnostics();

    let supabaseEventsCount: number | null = null;
    let supabaseQuizzesCount: number | null = null;
    if (hasSupabaseStorage()) {
      const eventsResult = await supabaseFetchEvents();
      if (eventsResult.status === "ok") {
        supabaseEventsCount = eventsResult.value.events?.length ?? 0;
      }
      const quizzesResult = await supabaseFetchQuizzes();
      if (quizzesResult.status === "ok") {
        supabaseQuizzesCount = quizzesResult.value.quizzes?.length ?? 0;
      }
    }

    let quizzesCount = supabaseQuizzesCount ?? 0;
    if (!canUseSupabaseStorage() || supabaseQuizzesCount === null) {
      const stored = await readAllStoredQuizzes();
      quizzesCount = stored.length;
    }

    const { registrations } = await readRegistrations();
    const appStorageBlobKeys = await countAppStorageBlobKeys();

    const summary = events.map((event) => ({
      slug: event.slug,
      venue: event.venue,
      pastResults: event.pastResults?.length ?? 0,
      pastResultsWithTeams: (event.pastResults ?? []).filter((r) => (r.teams?.length ?? 0) > 0).length,
      leagueTable: event.leagueTable?.length ?? 0,
    }));

    let quizLookup = null;
    if (slug && quizDate) {
      const stored = await readStoredQuiz(slug, normalizeDateKey(quizDate));
      quizLookup = {
        slug,
        date: quizDate,
        found: !!stored,
        teams: stored?.teams?.length ?? 0,
        storage: stored ? "quizzes" : "missing",
      };
    }

    const poll = await getPollStorageSummary();

    return NextResponse.json(
      {
        ok: true,
        storageVersion: "2026-09-28-regs-blob-manifest",
        diagnostics,
        storageBackend: {
          supabaseConfigured: hasSupabaseStorage(),
          supabaseActive: canUseSupabaseStorage(),
          supabaseDisabled: process.env.STORAGE_DISABLE_SUPABASE === "1",
          blobConfigured: hasBlobStorage(),
          supabaseEventsCount,
          supabaseQuizzesCount,
          liveEventsCount: events.length,
          liveRegistrationsCount: registrations.length,
          liveQuizzesCount: quizzesCount,
          appStorageBlobKeyCount: appStorageBlobKeys,
        },
        email: getRegistrationEmailDiagnostics(),
        quizzesCount,
        poll,
        events: summary,
        quizLookup,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message, diagnostics: getStorageDiagnostics() }, { status: 500 });
  }
}
