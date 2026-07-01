import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { QuizEvent, LeagueEntry } from "@/lib/data";
import { rebuildLeagueTableFromResults, sortLeagueTable } from "@/lib/data";
import { mergePastResults } from "@/lib/quiz-result-key";
import { patchEvent, updateEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rebuildLeagueTable(event: QuizEvent): LeagueEntry[] {
  return rebuildLeagueTableFromResults(event.pastResults ?? []);
}

class NotFoundError extends Error {
  constructor() {
    super("NOT_FOUND");
  }
}

function revalidatePublicEventPaths(slug: string) {
  revalidatePath("/");
  revalidatePath(`/udalosti/${slug}`);
  revalidatePath(`/liga/${slug}`);
  revalidatePath("/api/events");
  revalidatePath(`/api/events/${slug}`);
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const leagueActive: boolean =
      typeof body.leagueActive === "boolean"
        ? body.leagueActive
        : typeof body.active === "boolean"
        ? body.active
        : (null as unknown as boolean);

    if (typeof leagueActive !== "boolean") {
      return NextResponse.json({ error: "Chybny parameter leagueActive" }, { status: 400 });
    }

    const { events } = await updateEvents((events) => {
      const idx = events.findIndex((e) => e.slug === params.slug);
      if (idx === -1) throw new NotFoundError();

      const event = events[idx];
      let leagueTable = [...(event.leagueTable ?? [])];
      const pastResults = event.pastResults ?? [];

      if (leagueActive && leagueTable.length === 0 && pastResults.length > 0) {
        leagueTable = rebuildLeagueTable(event);
      }

      if (leagueActive && leagueTable.length === 0 && pastResults.length === 0) {
        throw new Error("LIGA_EMPTY");
      }

      events[idx] = { ...event, leagueTable, leagueActive };
      return events;
    });

    const updated = events.find((e) => e.slug === params.slug)!;
    revalidatePublicEventPaths(params.slug);
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e instanceof Error && e.message === "LIGA_EMPTY") {
      return NextResponse.json(
        { error: "Liga nema ziadne data. Najprv uloz kviz cez prezentaciu alebo pridaj vysledky." },
        { status: 400 }
      );
    }
    console.error("PATCH league error:", e);
    return NextResponse.json({ error: "Chyba pri ukladani ligy" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  const body = await req.json();
  const resetLeague = body._resetLeague === true;
  const leagueToggle = body._leagueToggle === true;
  const quizToggle = body._quizToggle === true;
  const includeLeagueData = body._includeLeagueData === true;
  const recalculateLeague = body._recalculateLeague === true;
  const {
    _resetLeague: _r,
    _leagueToggle: _lt,
    _quizToggle: _qt,
    _includeLeagueData: _ild,
    _recalculateLeague: _rl,
    ...incoming
  } = body;

  try {
    if (resetLeague || leagueToggle || quizToggle || recalculateLeague) {
      const { events } = await updateEvents(
        (events) => {
          const idx = events.findIndex((e) => e.slug === params.slug);
          if (idx === -1) throw new NotFoundError();

          const existing = events[idx];

          if (resetLeague) {
            events[idx] = {
              ...existing,
              ...incoming,
              slug: params.slug,
              leagueTable: [],
              pastResults: [],
              leagueActive: false,
            };
            return events;
          }

          if (leagueToggle && typeof incoming.leagueActive === "boolean") {
            let leagueTable = [...(existing.leagueTable ?? [])];
            let pastResults = [...(existing.pastResults ?? [])];

            if (Array.isArray(incoming.leagueTable) && incoming.leagueTable.length >= leagueTable.length) {
              leagueTable = incoming.leagueTable;
            }
            if (Array.isArray(incoming.pastResults)) {
              pastResults = mergePastResults(pastResults, incoming.pastResults);
            }

            if (pastResults.length > 0 && leagueTable.length === 0) {
              leagueTable = rebuildLeagueTable({ ...existing, pastResults });
            }

            if (incoming.leagueActive && leagueTable.length === 0 && pastResults.length === 0) {
              throw new Error("LIGA_EMPTY");
            }

            leagueTable = sortLeagueTable(leagueTable);
            events[idx] = { ...existing, leagueTable, pastResults, leagueActive: incoming.leagueActive };
            return events;
          }

          if (quizToggle && typeof incoming.active === "boolean") {
            events[idx] = { ...existing, active: incoming.active };
            return events;
          }

          if (recalculateLeague) {
            const fromQuizzes = body.fromQuizzes === true;
            const pastResults = existing.pastResults ?? [];
            let leagueTable =
              fromQuizzes && pastResults.length > 0
                ? rebuildLeagueTable(existing)
                : sortLeagueTable(existing.leagueTable ?? []);

            events[idx] = {
              ...existing,
              leagueTable,
              leagueActive: leagueTable.length > 0 || pastResults.length > 0 ? existing.leagueActive : false,
            };
            return events;
          }

          return events;
        },
        resetLeague ? { destructive: true } : undefined
      );

      const updated = events.find((e) => e.slug === params.slug)!;
      revalidatePublicEventPaths(params.slug);
      return NextResponse.json(updated);
    }

    const { leagueTable: _lt2, pastResults: _pr, leagueActive: _la, ...fields } = incoming;
    const updated = includeLeagueData
      ? await patchEvent(params.slug, incoming, { includeLeagueData: true })
      : await patchEvent(params.slug, fields);

    revalidatePublicEventPaths(params.slug);
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof NotFoundError || (e instanceof Error && e.message === "NOT_FOUND")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (e instanceof Error && e.message === "LIGA_EMPTY") {
      return NextResponse.json(
        { error: "Liga nemá žiadne dáta. Najprv ulož kvíz alebo pridaj tímy a klikni Uložiť zmeny." },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : "Chyba pri ukladani";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    await updateEvents((events) => events.filter((e) => e.slug !== params.slug), { destructive: true });
    revalidatePublicEventPaths(params.slug);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Chyba pri mazani" }, { status: 500 });
  }
}
