import { NextRequest, NextResponse } from "next/server";
import type { QuizEvent, LeagueEntry, PastResult } from "@/lib/data";
import { sortLeagueTable } from "@/lib/data";
import { rebuildLeagueFromPastResults } from "@/lib/league-rebuild";
import { mergePastResults } from "@/lib/quiz-result-key";
import { revalidatePublicEventPaths } from "@/lib/revalidate-public";
import { deletePollDataForEvent } from "@/lib/poll-storage";
import { deleteQuizDecksForEvent } from "@/lib/quiz-deck-storage";
import { deleteSeatPlansForPlace } from "@/lib/seat-plan-storage";
import {
  deleteStoredQuizzesForEvent,
  patchEvent,
  purgeRegistrationsForPlace,
  readAllEventsRaw,
  readEvents,
  rebuildLeagueTableForEvent,
  updateEvents,
} from "@/lib/storage";
import { deleteVenueTeamsForPlace } from "@/lib/venue-teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rebuildLeagueTable(event: QuizEvent): LeagueEntry[] {
  return rebuildLeagueFromPastResults(event.pastResults ?? [], event.slug).leagueTable;
}

class NotFoundError extends Error {
  constructor() {
    super("NOT_FOUND");
  }
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
    await revalidatePublicEventPaths(params.slug);
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
  const registrationToggle = body._registrationToggle === true;
  const includeLeagueData = body._includeLeagueData === true;
  const recalculateLeague = body._recalculateLeague === true;
  const promoChecklistToggle = body._promoChecklist === true;
  const {
    _resetLeague: _r,
    _leagueToggle: _lt,
    _quizToggle: _qt,
    _registrationToggle: _rt,
    _includeLeagueData: _ild,
    _recalculateLeague: _rl,
    _promoChecklist: _pcFlag,
    ...incoming
  } = body;

  try {
    if (promoChecklistToggle) {
      const { events } = await readEvents();
      const event = events.find((entry) => entry.slug === params.slug);
      if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const updated = await patchEvent(params.slug, {
        promoChecklist: {
          date: event.date,
          flyerSent: body.flyerSent === true,
          groupPosted: body.groupPosted === true,
          groupsShared: body.groupsShared === true,
        },
      });
      return NextResponse.json(updated);
    }

    if (registrationToggle && typeof incoming.registrationOpen === "boolean") {
      const updated = await patchEvent(params.slug, { registrationOpen: incoming.registrationOpen });
      await revalidatePublicEventPaths(params.slug);
      return NextResponse.json(updated);
    }

    if (resetLeague || leagueToggle || quizToggle || recalculateLeague) {
      const fromQuizzes = body.fromQuizzes === true;
      let rebuiltLeague: { leagueTable: LeagueEntry[]; pastResults: PastResult[] } | null = null;
      if (recalculateLeague && fromQuizzes) {
        const { events: currentEvents } = await updateEvents((events) => events);
        const current = currentEvents.find((event) => event.slug === params.slug);
        if (!current) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        rebuiltLeague = await rebuildLeagueTableForEvent(current);
        if (rebuiltLeague.leagueTable.length === 0 && (current.leagueTable?.length ?? 0) === 0) {
          return NextResponse.json(
            {
              error:
                "Ligu sa nepodarilo prepočítať — chýbajú kvízové dáta aj existujúca tabuľka. Pridaj kvíz cez prezentáciu alebo obnov ligu zo zálohy.",
            },
            { status: 400 }
          );
        }
      }

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
            if (fromQuizzes && rebuiltLeague) {
              events[idx] = {
                ...existing,
                leagueTable: rebuiltLeague.leagueTable,
                pastResults: rebuiltLeague.pastResults,
                leagueActive:
                  rebuiltLeague.leagueTable.length > 0 || rebuiltLeague.pastResults.length > 0
                    ? existing.leagueActive
                    : false,
              };
              return events;
            }

            events[idx] = {
              ...existing,
              leagueTable: sortLeagueTable(existing.leagueTable ?? []),
              leagueActive: existing.leagueActive,
            };
            return events;
          }

          return events;
        },
        resetLeague ? { destructive: true } : undefined
      );

      const updated = events.find((e) => e.slug === params.slug)!;
      await revalidatePublicEventPaths(params.slug);
      return NextResponse.json(updated);
    }

    const { leagueTable: _lt2, pastResults: _pr, leagueActive: _la, promoChecklist: _pc, ...fields } = incoming;
    const leaguePayload = { ...incoming } as Partial<QuizEvent>;
    delete leaguePayload.promoChecklist;
    const updated = includeLeagueData
      ? await patchEvent(params.slug, leaguePayload, { includeLeagueData: true })
      : await patchEvent(params.slug, fields);

    await revalidatePublicEventPaths(params.slug);
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
    const { events } = await readAllEventsRaw();
    const event = events.find((entry) => entry.slug === params.slug);
    const venue = event?.venue ?? "";

    await purgeRegistrationsForPlace(params.slug, venue);
    await deleteStoredQuizzesForEvent(params.slug);
    await deleteVenueTeamsForPlace(params.slug, venue);
    await deletePollDataForEvent(params.slug);
    await deleteSeatPlansForPlace(params.slug, venue);
    await deleteQuizDecksForEvent(params.slug);
    await updateEvents((list) => list.filter((entry) => entry.slug !== params.slug), { destructive: true });
    await revalidatePublicEventPaths(params.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri mazani";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
