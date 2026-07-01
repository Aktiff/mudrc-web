import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { normalizeDateKey } from "@/lib/quiz-result-key";
import { hasQuizForDate, readStoredQuiz, readEvents, updateEvents, upsertStoredQuiz } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TeamEntry = { name: string; scores: number[] };

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { date, teams }: { date: string; teams: TeamEntry[] } = await req.json();
  if (!date || !teams?.length) {
    return NextResponse.json({ error: "Chýba dátum alebo tímy" }, { status: 400 });
  }

  const withTotals = teams.map((t) => ({
    name: t.name.trim(),
    scores: t.scores.map((s) => Number(s) || 0),
    total: t.scores.reduce((a, b) => a + (Number(b) || 0), 0),
  }));

  const sorted = [...withTotals].sort((a, b) => b.total - a.total);
  const n = sorted.length;
  const ligaPoints: number[] = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && sorted[j].total === sorted[j + 1].total) j++;
    const avgPoints = (n - 1 - i + (n - 1 - j)) / 2;
    for (let k = i; k <= j; k++) ligaPoints[k] = avgPoints;
    i = j + 1;
  }

  const winnerTotal = sorted[0].total;
  const winners = sorted.filter((t) => t.total === winnerTotal);
  const winnerTeam = winners.length === 1 ? winners[0].name : winners.map((t) => t.name).join(" / ");
  const responseLigaPoints = sorted.map((t, idx) => ({ name: t.name, total: t.total, liga: ligaPoints[idx] }));

  const teamsDetail = sorted.map((team, rankIdx) => ({
    teamName: team.name,
    rounds: team.scores,
    total: team.total,
    ligaPoints: ligaPoints[rankIdx],
  }));

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
      sorted.forEach((team, rankIdx) => {
        const pts = ligaPoints[rankIdx];
        const existing = table.find((r) => r.teamName === team.name);
        if (existing) {
          existing.points += pts;
          existing.quizzesPlayed += 1;
        } else {
          table.push({ rank: 0, teamName: team.name, points: pts, quizzesPlayed: 1 });
        }
      });

      table.sort((a, b) => b.points - a.points || b.quizzesPlayed - a.quizzesPlayed);
      table.forEach((r, rank) => {
        r.rank = rank + 1;
      });

      const pastResults = [
        ...(event.pastResults ?? []).filter((r) => normalizeDateKey(r.date) !== resultId && r.id !== resultId),
        { id: resultId, date, winnerTeam, points: winnerTotal, teams: teamsDetail },
      ];

      events[idx] = { ...event, leagueTable: table, pastResults, leagueActive: true };
      return events;
    });
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

  revalidatePath("/liga");
  revalidatePath(`/liga/${params.slug}`);
  revalidatePath("/");
  revalidatePath(`/udalosti/${params.slug}`);
  revalidatePath("/api/events");
  revalidatePath(`/api/events/${params.slug}`);

  return NextResponse.json({
    ok: true,
    winnerTeam,
    event: saved,
    ligaPoints: responseLigaPoints,
  });
}
