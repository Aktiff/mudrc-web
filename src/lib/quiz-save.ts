import type { PastResultTeam } from "@/lib/data";
import { calcLigaPointsForTotals, roundQuizTotal } from "@/lib/league-points";

type TeamEntry = { name: string; scores: number[]; total?: number };

export function buildQuizTeamsDetail(teams: TeamEntry[]) {
  const withTotals = teams.map((team) => ({
    name: team.name.trim(),
    scores: team.scores.map((score) => Number(score) || 0),
    total:
      team.total !== undefined
        ? roundQuizTotal(Number(team.total))
        : roundQuizTotal(team.scores.reduce((sum, score) => sum + (Number(score) || 0), 0)),
  }));

  const sorted = [...withTotals].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "sk")
  );

  const ligaPointsMap = calcLigaPointsForTotals(
    sorted.map((team) => ({ teamName: team.name, total: team.total }))
  );

  const teamsDetail: PastResultTeam[] = sorted.map((team) => ({
    teamName: team.name,
    rounds: team.scores,
    total: team.total,
    ligaPoints: ligaPointsMap.get(team.name) ?? 0,
  }));

  const winnerTeam = sorted[0]?.name ?? "";
  const winnerTotal = sorted[0]?.total ?? 0;

  const responseLigaPoints = sorted.map((team) => ({
    name: team.name,
    total: team.total,
    liga: ligaPointsMap.get(team.name) ?? 0,
  }));

  return { sorted, teamsDetail, winnerTeam, winnerTotal, responseLigaPoints };
}
