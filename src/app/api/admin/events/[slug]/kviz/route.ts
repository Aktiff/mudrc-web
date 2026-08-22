import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sortLeagueTable } from "@/lib/data";
import { normalizeDateKey } from "@/lib/quiz-result-key";
import { buildQuizTeamsDetail } from "@/lib/quiz-save";
import { isCanvasLibraryQuiz, normalizeResultLibraryQuizId } from "@/lib/quiz-result-library";
import { revalidatePublicEventPaths } from "@/lib/revalidate-public";
import { hasQuizForDate, readStoredQuiz, readEvents, updateEvents, upsertStoredQuiz } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TeamEntry = { name: string; scores: number[]; total?: number };

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { date, teams, libraryQuizId }: { date: string; teams: TeamEntry[]; libraryQuizId?: string } =
    await req.json();
  if (!date || !teams?.length) {
    return NextResponse.json({ error: "Chýba dátum alebo tímy" }, { status: 400 });
  }
  const normalizedLibraryQuizId = normalizeResultLibraryQuizId(libraryQuizId);
  if (!normalizedLibraryQuizId) {
    return NextResponse.json(
      { error: "Vyber hotový kvíz z knižnice alebo „Kvíz v Canve“." },
      { status: 400 }
    );
  }

  const { sorted, teamsDetail, winnerTeam, winnerTotal, responseLigaPoints } = buildQuizTeamsDetail(teams);
  const resultId = normalizeDateKey(date);

  if (await hasQuizForDate(params.slug, date)) {
    return NextResponse.json(
      { error: "Kvíz s týmto dátumom je už vytvorený. Zvoľ iný dátum alebo existujúci kvíz uprav vo Výsledkoch." },
      { status: 409 }
    );
  }

  try {
    await upsertStoredQuiz({
      id: resultId,
      eventSlug: params.slug,
      date,
      winnerTeam,
      points: winnerTotal,
      teams: teamsDetail,
      libraryQuizId: normalizedLibraryQuizId,
    });
  } catch (error) {
    console.error("upsertStoredQuiz error:", error);
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní kvízu";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await updateEvents((events) => {
      const idx = events.findIndex((e) => e.slug === params.slug);
      if (idx === -1) throw new Error("NOT_FOUND");

      const event = events[idx];
      const table = [...(event.leagueTable ?? [])];
      sorted.forEach((team) => {
        const pts = teamsDetail.find((row) => row.teamName === team.name)?.ligaPoints ?? 0;
        const existing = table.find((r) => r.teamName === team.name);
        if (existing) {
          existing.points += pts;
          existing.quizzesPlayed += 1;
        } else {
          table.push({ rank: 0, teamName: team.name, points: pts, quizzesPlayed: 1 });
        }
      });

      table.sort((a, b) => b.points - a.points || b.quizzesPlayed - a.quizzesPlayed);
      const sortedTable = sortLeagueTable(table);
      const pastResults = [
        ...(event.pastResults ?? []).filter((r) => normalizeDateKey(r.date) !== resultId && r.id !== resultId),
        { id: resultId, date, winnerTeam, points: winnerTotal, teams: teamsDetail, leagueSynced: true, libraryQuizId: normalizedLibraryQuizId },
      ];

      events[idx] = { ...event, leagueTable: sortedTable, pastResults, leagueActive: true };
      return events;    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("POST kviz league update error:", error);
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní ligy";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const savedQuiz = await readStoredQuiz(params.slug, resultId);
  if (!savedQuiz?.teams?.length) {
    return NextResponse.json(
      { error: "Kvíz sa nepodarilo uložiť do databázy. Skontroluj Supabase pripojenie." },
      { status: 500 }
    );
  }

  const { events } = await readEvents();
  const saved = events.find((e) => e.slug === params.slug);

  await revalidatePublicEventPaths(params.slug);
  revalidatePath("/liga");

  return NextResponse.json({
    ok: true,
    winnerTeam,
    event: saved,
    ligaPoints: responseLigaPoints,
    canvasQuiz: isCanvasLibraryQuiz(normalizedLibraryQuizId),
  });
}
