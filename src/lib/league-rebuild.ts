import type { QuizEvent } from "@/lib/data";
import { getSeedLeagueData } from "@/lib/league-seed";
import {
  fixPastResultsLigaPoints,
  mergeLegacyWithDetailed,
  sumLeagueFromDetailedResults,
} from "@/lib/league-points";
import { mergePastResults } from "@/lib/quiz-result-key";
import type { PastResult } from "@/lib/data";

export function rebuildLeagueFromPastResults(
  pastResults: PastResult[],
  eventSlug: string
): { leagueTable: QuizEvent["leagueTable"]; pastResults: PastResult[] } {
  const fixedResults = fixPastResultsLigaPoints(pastResults);
  const fromDetailed = sumLeagueFromDetailedResults(fixedResults);
  const hasSummaryOnly = fixedResults.some((result) => !result.teams?.length);

  if (!hasSummaryOnly) {
    return { leagueTable: fromDetailed, pastResults: fixedResults };
  }

  const seed = getSeedLeagueData(eventSlug);
  if (seed?.leagueTable?.length) {
    return {
      leagueTable: mergeLegacyWithDetailed(seed.leagueTable, fromDetailed),
      pastResults: fixedResults,
    };
  }

  return { leagueTable: fromDetailed, pastResults: fixedResults };
}
