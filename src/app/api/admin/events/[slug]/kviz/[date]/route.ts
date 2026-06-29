import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { QuizEvent } from "@/lib/data";

const dataPath = path.join(process.cwd(), "src/data/events.json");

function readData(): { events: QuizEvent[] } {
  let raw = fs.readFileSync(dataPath, "utf-8");
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function writeData(data: { events: QuizEvent[] }) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf-8");
}

type TeamEntry = { name: string; scores: number[]; total?: number };

function calcLigaPoints(teams: TeamEntry[]): { name: string; scores: number[]; total: number; ligaPoints: number }[] {
  const withTotals = teams.map((t) => ({
    name: t.name.trim(),
    scores: t.scores.map((s) => Number(s) || 0),
    // If total is explicitly provided (e.g. tiebreaker bonus), use it; otherwise sum from scores
    total: t.total !== undefined ? Number(t.total) : t.scores.reduce((a, b) => a + (Number(b) || 0), 0),
  }));
  const sorted = [...withTotals].sort((a, b) => b.total - a.total);
  const n = sorted.length;
  const ligaPoints: number[] = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && sorted[j].total === sorted[j + 1].total) j++;
    const avgPoints = ((n - 1 - i) + (n - 1 - j)) / 2;
    for (let k = i; k <= j; k++) ligaPoints[k] = avgPoints;
    i = j + 1;
  }
  return sorted.map((t, i) => ({ ...t, ligaPoints: ligaPoints[i] }));
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string; date: string } }) {
  const { date: newDate, teams }: { date: string; teams: TeamEntry[] } = await req.json();

  const validTeams = teams.filter((t) => t.name.trim());
  if (!newDate || validTeams.length < 2) {
    return NextResponse.json({ error: "Chyba vstupnych dat" }, { status: 400 });
  }

  const data = readData();
  const idx = data.events.findIndex((e) => e.slug === params.slug);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const event = data.events[idx];
  const resultIdx = event.pastResults.findIndex((r) => (r.id ?? r.date.replace(/\./g, "-")) === params.date);
  if (resultIdx === -1) return NextResponse.json({ error: "Result not found" }, { status: 404 });

  const oldResult = event.pastResults[resultIdx];
  const table = [...(event.leagueTable ?? [])];

  // Reverse old liga points
  if (oldResult.teams) {
    for (const ot of oldResult.teams) {
      const entry = table.find((r) => r.teamName === ot.teamName);
      if (entry) {
        entry.points -= ot.ligaPoints;
        entry.quizzesPlayed -= 1;
        if (entry.points <= 0 && entry.quizzesPlayed <= 0) {
          const ei = table.indexOf(entry);
          table.splice(ei, 1);
        }
      }
    }
  }

  // Calculate new results
  const newCalc = calcLigaPoints(validTeams);
  const newSorted = newCalc; // already sorted by total desc

  const winners = newSorted.filter((t) => t.total === newSorted[0].total);
  const winnerTeam = winners.length === 1 ? winners[0].name : winners.map((t) => t.name).join(" / ");

  // Apply new liga points
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
  table.forEach((r, i) => { r.rank = i + 1; });

  const teamsDetail = newSorted.map((t) => ({
    teamName: t.name,
    rounds: t.scores,
    total: t.total,
    ligaPoints: t.ligaPoints,
  }));

  event.pastResults[resultIdx] = {
    id: oldResult.id ?? params.date,
    date: newDate,
    winnerTeam,
    points: newSorted[0].total,
    teams: teamsDetail,
  };
  data.events[idx] = { ...event, leagueTable: table };
  writeData(data);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string; date: string } }) {
  const data = readData();
  const idx = data.events.findIndex((e) => e.slug === params.slug);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const event = data.events[idx];
  const resultIdx = event.pastResults.findIndex((r) => (r.id ?? r.date.replace(/\./g, "-")) === params.date);
  if (resultIdx === -1) return NextResponse.json({ error: "Result not found" }, { status: 404 });

  event.pastResults.splice(resultIdx, 1);
  writeData(data);
  return NextResponse.json({ ok: true });
}
