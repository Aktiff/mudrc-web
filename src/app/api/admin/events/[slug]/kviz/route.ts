import { NextRequest, NextResponse } from "next/server";
import { readEvents, writeEvents } from "@/lib/storage";
type TeamEntry = { name: string; scores: number[] };

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { date, teams }: { date: string; teams: TeamEntry[] } = await req.json();
  if (!date || !teams?.length) {
    return NextResponse.json({ error: "Chýba dátum alebo tímy" }, { status: 400 });
  }

  const data = await readEvents();
  const idx = data.events.findIndex((e) => e.slug === params.slug);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const event = data.events[idx];

  // Calculate totals
  const withTotals = teams.map((t) => ({
    name: t.name.trim(),
    scores: t.scores.map((s) => Number(s) || 0),
    total: t.scores.reduce((a, b) => a + (Number(b) || 0), 0),
  }));

  // Sort by total descending to determine ranks
  const sorted = [...withTotals].sort((a, b) => b.total - a.total);
  const n = sorted.length;

  // Calculate ligové body with tie averaging
  // ligaPoints[i] = how many teams team at position i beats
  // base: position 0 gets (n-1), position 1 gets (n-2), etc.
  // for ties: average the points of tied positions
  const ligaPoints: number[] = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && sorted[j].total === sorted[j + 1].total) j++;
    // positions i..j are tied
    const avgPoints = ((n - 1 - i) + (n - 1 - j)) / 2;
    for (let k = i; k <= j; k++) ligaPoints[k] = avgPoints;
    i = j + 1;
  }

  // Determine winner (first in sorted, could be tie)
  const winnerTotal = sorted[0].total;
  const winners = sorted.filter((t) => t.total === winnerTotal);
  const winnerTeam = winners.length === 1 ? winners[0].name : winners.map((t) => t.name).join(" / ");

  // Update league table
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

  // Re-sort and re-rank table
  table.sort((a, b) => b.points - a.points || b.quizzesPlayed - a.quizzesPlayed);
  table.forEach((r, i) => { r.rank = i + 1; });

  // Build per-team result for detail page
  const teamsDetail = sorted.map((team, i) => ({
    teamName: team.name,
    rounds: team.scores,
    total: team.total,
    ligaPoints: ligaPoints[i],
  }));

  const id = crypto.randomUUID();

  // Add to pastResults
  const pastResults = [
    ...(event.pastResults ?? []),
    { id, date, winnerTeam, points: winnerTotal, teams: teamsDetail },
  ];

  data.events[idx] = { ...event, leagueTable: table, pastResults };
  await writeEvents(data);

  return NextResponse.json({ ok: true, winnerTeam, ligaPoints: sorted.map((t, i) => ({ name: t.name, total: t.total, liga: ligaPoints[i] })) });
}

