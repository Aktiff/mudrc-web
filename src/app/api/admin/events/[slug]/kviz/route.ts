import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { QuizEvent } from "@/lib/data";
import { updateEvents } from "@/lib/storage";

type TeamEntry = { name: string; scores: number[] };

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { date, teams }: { date: string; teams: TeamEntry[] } = await req.json();
  if (!date || !teams?.length) {
    return NextResponse.json({ error: "Chýba dátum alebo tímy" }, { status: 400 });
  }

  let updatedEvent: QuizEvent | null = null;
  let winnerTeam = "";
  let responseLigaPoints: { name: string; total: number; liga: number }[] = [];

  try {
    await updateEvents((events) => {
      const idx = events.findIndex((e) => e.slug === params.slug);
      if (idx === -1) throw new Error("NOT_FOUND");

      const event = events[idx];
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
      winnerTeam = winners.length === 1 ? winners[0].name : winners.map((t) => t.name).join(" / ");
      responseLigaPoints = sorted.map((t, idx) => ({ name: t.name, total: t.total, liga: ligaPoints[idx] }));

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

      const teamsDetail = sorted.map((team, rankIdx) => ({
        teamName: team.name,
        rounds: team.scores,
        total: team.total,
        ligaPoints: ligaPoints[rankIdx],
      }));

      const pastResults = [
        ...(event.pastResults ?? []),
        { id: crypto.randomUUID(), date, winnerTeam, points: winnerTotal, teams: teamsDetail },
      ];

      updatedEvent = { ...event, leagueTable: table, pastResults, leagueActive: true };
      events[idx] = updatedEvent;
      return events;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  revalidatePath("/liga");
  revalidatePath(`/liga/${params.slug}`);

  return NextResponse.json({
    ok: true,
    winnerTeam,
    event: updatedEvent,
    ligaPoints: responseLigaPoints,
  });
}
