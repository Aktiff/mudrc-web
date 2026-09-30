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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const quizDate = url.searchParams.get("date");

  try {
    const { events } = await readEvents();
    const diagnostics = getStorageDiagnostics();
    const stored = await readAllStoredQuizzes();
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
      const quiz = await readStoredQuiz(slug, normalizeDateKey(quizDate));
      quizLookup = {
        slug,
        date: quizDate,
        found: !!quiz,
        teams: quiz?.teams?.length ?? 0,
        storage: quiz ? "blob" : "missing",
      };
    }

    const poll = await getPollStorageSummary();

    return NextResponse.json(
      {
        ok: true,
        storageVersion: "2026-09-30-blob-only",
        diagnostics,
        storageBackend: {
          blobConfigured: hasBlobStorage(),
          liveEventsCount: events.length,
          liveRegistrationsCount: registrations.length,
          liveQuizzesCount: stored.length,
          appStorageBlobKeyCount: appStorageBlobKeys,
        },
        email: getRegistrationEmailDiagnostics(),
        quizzesCount: stored.length,
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
