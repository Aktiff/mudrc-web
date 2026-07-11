import type { LeagueEntry, PastResult, PastResultTeam } from "@/lib/data";
import { sortLeagueTable } from "@/lib/data";
import { quizResultKey } from "@/lib/quiz-result-key";

export function roundQuizTotal(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Ligové body podľa poradia — bez priemerovania remíz (rozstrel rieši poradie v prezentácii). */
export function calcLigaPointsForTotals(totals: { teamName: string; total: number }[]): Map<string, number> {
  const sorted = [...totals]
    .map((entry) => ({ ...entry, total: roundQuizTotal(entry.total) }))
    .sort(
      (a, b) =>
        b.total - a.total || a.teamName.trim().localeCompare(b.teamName.trim(), "sk")
    );

  const n = sorted.length;
  const map = new Map<string, number>();
  sorted.forEach((entry, index) => {
    map.set(entry.teamName.trim(), Math.max(0, n - 1 - index));
  });
  return map;
}

export function recalcTeamsLigaPoints(teams: PastResultTeam[]): PastResultTeam[] {
  const pointsMap = calcLigaPointsForTotals(
    teams.map((team) => ({ teamName: team.teamName, total: team.total }))
  );
  return teams.map((team) => ({
    ...team,
    ligaPoints: pointsMap.get(team.teamName.trim()) ?? 0,
  }));
}

export function sumLeagueFromDetailedResults(pastResults: PastResult[]): LeagueEntry[] {
  const table: LeagueEntry[] = [];
  const seenQuizKeys = new Set<string>();

  for (const result of pastResults) {
    if (!result.teams?.length) continue;
    const key = quizResultKey(result);
    if (seenQuizKeys.has(key)) continue;
    seenQuizKeys.add(key);

    const teams = recalcTeamsLigaPoints(result.teams);
    for (const team of teams) {
      const name = team.teamName.trim();
      if (!name) continue;
      const existing = table.find((row) => row.teamName === name);
      if (existing) {
        existing.points += team.ligaPoints;
        existing.quizzesPlayed += 1;
      } else {
        table.push({
          rank: 0,
          teamName: name,
          points: team.ligaPoints,
          quizzesPlayed: 1,
        });
      }
    }
  }

  return sortLeagueTable(table);
}

export function mergeLegacyWithDetailed(legacy: LeagueEntry[], detailed: LeagueEntry[]): LeagueEntry[] {
  const map = new Map<string, LeagueEntry>();

  for (const row of legacy) {
    const name = row.teamName.trim();
    if (!name) continue;
    map.set(name, {
      rank: 0,
      teamName: name,
      points: row.points,
      quizzesPlayed: row.quizzesPlayed,
    });
  }

  for (const row of detailed) {
    const name = row.teamName.trim();
    if (!name) continue;
    const prev = map.get(name);
    if (prev) {
      prev.points += row.points;
      prev.quizzesPlayed += row.quizzesPlayed;
    } else {
      map.set(name, { rank: 0, teamName: name, points: row.points, quizzesPlayed: row.quizzesPlayed });
    }
  }

  return sortLeagueTable(Array.from(map.values()));
}

export function fixPastResultsLigaPoints(pastResults: PastResult[]): PastResult[] {
  return pastResults.map((result) => {
    if (!result.teams?.length) return result;
    return {
      ...result,
      teams: recalcTeamsLigaPoints(result.teams),
      leagueSynced: true,
    };
  });
}
