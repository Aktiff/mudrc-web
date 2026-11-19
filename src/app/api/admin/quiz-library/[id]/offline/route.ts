import { NextRequest, NextResponse } from "next/server";
import type { QuizEvent } from "@/lib/data";
import { requireAdminSession } from "@/lib/admin-permissions";
import { listGrantedEventSlugs } from "@/lib/moderator-grants";
import { normalizeLibraryQuiz } from "@/lib/quiz-library";
import { readLibraryQuiz } from "@/lib/quiz-library-storage";
import { hydrateQuizMediaForPlayback } from "@/lib/quiz-media-resolve";
import { buildOfflinePresentationPackage } from "@/lib/offline-presentation/build-package";
import { readAllEventsRaw } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: { id: string } };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const sessionOrRes = requireAdminSession(req);
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  try {
    const quiz = await readLibraryQuiz(params.id);
    if (!quiz) {
      return NextResponse.json({ error: "Kvíz nenájdený" }, { status: 404 });
    }

    const normalized = normalizeLibraryQuiz(quiz);
    const hydrated = await hydrateQuizMediaForPlayback(normalized);
    const data = await readAllEventsRaw();
    let events: QuizEvent[] = data.events;
    if (session.role === "moderator") {
      const allowed = new Set(await listGrantedEventSlugs(session.username));
      events = events.filter((event) => allowed.has(event.slug));
    }
    const cookieHeader = req.headers.get("cookie") ?? undefined;

    const result = await buildOfflinePresentationPackage({
      quiz: hydrated,
      events,
      cookieHeader,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          failedUrls: result.failedUrls ?? [],
        },
        { status: 422 }
      );
    }

    return new NextResponse(Buffer.from(result.zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
        "X-Mudrc-Offline-Media": String(result.mediaCount),
        "X-Mudrc-Offline-Warnings": result.warnings.length ? "1" : "0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Offline balík sa nepodarilo vytvoriť.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
