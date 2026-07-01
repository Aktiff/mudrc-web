import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TeamEntry = { name: string; scores: number[]; total?: number };

function calcLigaPoints(teams: TeamEntry[]): { name: string; scores: number[]; total: number; ligaPoints: number }[] {
  const withTotals = teams.map((t) => ({
    name: t.name.trim(),
    scores: t.scores.map((s) => Number(s) || 0),
    total: t.total !== undefined ? Number(t.total) : t.scores.reduce((a, b) => a + (Number(b) || 0), 0),
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
  return sorted.map((t, idx) => ({ ...t, ligaPoints: ligaPoints[idx] }));
}

function reverseQuizFromTable(
  table: { rank: number; teamName: string; points: number; quizzesPlayed: number }[],
  oldResult: { teams?: { teamName: string; ligaPoints: number }[] }
) {
  if (!oldResult.teams) return;
  for (const ot of oldResult.teams) {
    const entry = table.find((r) => r.teamName === ot.teamName);
    if (!entry) continue;
    entry.points -= ot.ligaPoints;
    entry.quizzesPlayed -= 1;
    if (entry.points <= 0 && entry.quizzesPlayed <= 0) {
      const ei = table.indexOf(entry);
      table.splice(ei, 1);
    }
  }
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string; date: string } }) {
  const { date: newDate, teams }: { date: string; teams: TeamEntry[] } = await req.json();
  const validTeams = teams.filter((t) => t.name.trim());
  if (!newDate || validTeams.length < 2) {
    return NextResponse.json({ error: "Chyba vstupnych dat" }, { status: 400 });
  }

  try {
    const { events } = await updateEvents((events) => {
      const idx = events.findIndex((e) => e.slug === params.slug);
      if (idx === -1) throw new Error("NOT_FOUND");

      const event = events[idx];
      const resultIdx = event.pastResults.findIndex((r) => (r.id ?? r.date.replace(/\./g, "-")) === params.date);
      if (resultIdx === -1) throw new Error("RESULT_NOT_FOUND");

      const oldResult = event.pastResults[resultIdx];
      const table = [...(event.leagueTable ?? [])];
      reverseQuizFromTable(table, oldResult);

      const newSorted = calcLigaPoints(validTeams);
      const winners = newSorted.filter((t) => t.total === newSorted[0].total);
      const winnerTeam = winners.length === 1 ? winners[0].name : winners.map((t) => t.name).join(" / ");

      for (const team of newSorted) {
        const existing = table.find((r) => r.teamName === team.name);
        if (existing) {
          existing.points += team.ligaPoints;
          existing.quizzesPlayed += 1;
        } else {
          table.push({ rank: 0, teamName: team.name, points: team.ligaPoints, quizzesPlayed: 1 });
        }
      }

      table.sort((a, b) => b.points - a.points || b.quizzesPlayed - a.quizzesPlayed);
      table.forEach((r, i) => {
        r.rank = i + 1;
      });

      const teamsDetail = newSorted.map((t) => ({
        teamName: t.name,
        rounds: t.scores,
        total: t.total,
        ligaPoints: t.ligaPoints,
      }));

      const pastResults = [...event.pastResults];
      pastResults[resultIdx] = {
        id: oldResult.id ?? params.date,
        date: newDate,
        winnerTeam,
        points: newSorted[0].total,
        teams: teamsDetail,
      };

      events[idx] = { ...event, leagueTable: table, pastResults, leagueActive: true };
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
  try {
    await updateEvents(
      (events) => {
        const idx = events.findIndex((e) => e.slug === params.slug);
        if (idx === -1) throw new Error("NOT_FOUND");

        const event = events[idx];
        const resultIdx = event.pastResults.findIndex((r) => (r.id ?? r.date.replace(/\./g, "-")) === params.date);
        if (resultIdx === -1) throw new Error("RESULT_NOT_FOUND");

        const oldResult = event.pastResults[resultIdx];
        const table = [...(event.leagueTable ?? [])];
        reverseQuizFromTable(table, oldResult);
        table.sort((a, b) => b.points - a.points || b.quizzesPlayed - a.quizzesPlayed);
        table.forEach((r, i) => {
          r.rank = i + 1;
        });

        const pastResults = event.pastResults.filter((_, i) => i !== resultIdx);
        events[idx] = { ...event, leagueTable: table, pastResults };
        return events;
      },
      { destructive: true }
    );
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
