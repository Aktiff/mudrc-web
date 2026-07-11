import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sortLeagueTable } from "@/lib/data";
import { findQuizResultIndex, normalizeDateKey } from "@/lib/quiz-result-key";
import { buildQuizTeamsDetail } from "@/lib/quiz-save";
import { revalidatePublicEventPaths } from "@/lib/revalidate-public";
import { deleteStoredQuiz, readQuizResult, rebuildLeagueTableForEvent, updateEvents, upsertStoredQuiz } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TeamEntry = { name: string; scores: number[]; total?: number };

export async function GET(_req: NextRequest, { params }: { params: { slug: string; date: string } }) {
  const data = await readQuizResult(params.slug, params.date);
  if (!data) {
    return NextResponse.json({ error: "Kvíz nebol nájdený alebo nemá dáta tímov." }, { status: 404 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string; date: string } }) {
  const { date: newDate, teams }: { date: string; teams: TeamEntry[] } = await req.json();
  const validTeams = teams.filter((t) => t.name.trim());
  if (!newDate || validTeams.length < 2) {
    return NextResponse.json({ error: "Chyba vstupnych dat" }, { status: 400 });
  }

  const existing = await readQuizResult(params.slug, params.date);
  if (!existing) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  const { sorted, teamsDetail, winnerTeam, winnerTotal } = buildQuizTeamsDetail(validTeams);
  const quizId = existing.result.id ?? normalizeDateKey(existing.result.date);

  try {
    await upsertStoredQuiz({
      id: quizId,
      eventSlug: params.slug,
      date: newDate,
      winnerTeam,
      points: winnerTotal,
      teams: teamsDetail,
    });
  } catch (error) {
    console.error("upsertStoredQuiz PUT error:", error);
    return NextResponse.json({ error: "Chyba pri ukladani kvizu" }, { status: 500 });
  }

  try {
    const { events } = await updateEvents((events) => {
      const idx = events.findIndex((e) => e.slug === params.slug);
      if (idx === -1) throw new Error("NOT_FOUND");

      const event = events[idx];
      const resultIdx = findQuizResultIndex(event.pastResults, params.date);
      if (resultIdx === -1) throw new Error("RESULT_NOT_FOUND");

      const oldResult = event.pastResults[resultIdx];
      const table = [...(event.leagueTable ?? [])];

      if (oldResult.teams) {
        for (const ot of oldResult.teams) {
          const entry = table.find((r) => r.teamName === ot.teamName);
          if (!entry) continue;
          entry.points -= ot.ligaPoints;
          entry.quizzesPlayed -= 1;
          if (entry.points <= 0 && entry.quizzesPlayed <= 0) {
            table.splice(table.indexOf(entry), 1);
          }
        }
      }

      for (const team of sorted) {
        const pts = teamsDetail.find((row) => row.teamName === team.name)?.ligaPoints ?? 0;
        const row = table.find((r) => r.teamName === team.name);
        if (row) {
          row.points += pts;
          row.quizzesPlayed += 1;
        } else {
          table.push({ rank: 0, teamName: team.name, points: pts, quizzesPlayed: 1 });
        }
      }

      const pastResults = [...event.pastResults];
      pastResults[resultIdx] = {
        id: quizId,
        date: newDate,
        winnerTeam,
        points: winnerTotal,
        teams: teamsDetail,
        leagueSynced: true,
      };

      events[idx] = {
        ...event,
        leagueTable: sortLeagueTable(table),
        pastResults,
        leagueActive: true,
      };
      return events;
    });

    const updated = events.find((e) => e.slug === params.slug)!;
    revalidatePath("/liga");
    revalidatePath(`/liga/${params.slug}`);
    return NextResponse.json({ ok: true, event: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "RESULT_NOT_FOUND") {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Chyba pri ukladani kvizu" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string; date: string } }) {
  const existing = await readQuizResult(params.slug, params.date);
  if (!existing) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  try {
    await deleteStoredQuiz(params.slug, params.date);
  } catch (error) {
    console.error("deleteStoredQuiz error:", error);
    return NextResponse.json({ error: "Chyba pri mazani kvizu" }, { status: 500 });
  }

  try {
    await updateEvents(
      (events) => {
        const idx = events.findIndex((e) => e.slug === params.slug);
        if (idx === -1) throw new Error("NOT_FOUND");

        const event = events[idx];
        const resultIdx = findQuizResultIndex(event.pastResults, params.date);
        if (resultIdx === -1) throw new Error("RESULT_NOT_FOUND");

        const pastResults = event.pastResults.filter((_, i) => i !== resultIdx);
        events[idx] = { ...event, pastResults };
        return events;
      },
      { destructive: true }
    );

    const { events } = await updateEvents((events) => events);
    const event = events.find((entry) => entry.slug === params.slug);
    if (event) {
      const rebuilt = await rebuildLeagueTableForEvent(event);
      if (rebuilt.leagueTable.length > 0) {
        await updateEvents((all) =>
          all.map((entry) =>
            entry.slug === params.slug
              ? { ...entry, leagueTable: rebuilt.leagueTable, pastResults: rebuilt.pastResults, leagueActive: true }
              : entry
          )
        );
      }
    }

    await revalidatePublicEventPaths(params.slug);
    revalidatePath("/liga");
    revalidatePath(`/liga/${params.slug}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "RESULT_NOT_FOUND") {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Chyba pri mazani kvizu" }, { status: 500 });
  }
}
