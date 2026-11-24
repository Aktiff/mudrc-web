import type { QuizEvent } from "@/lib/data";
import { teamKey } from "@/lib/poll";
import type { VenueTeam } from "@/lib/venue-team-contact";

/** Names that count as this team in league / results (own name + liga display name). */
function attendanceNameKeys(team: VenueTeam): Set<string> {
  const keys = new Set<string>();
  for (const raw of [team.teamName, team.leagueName]) {
    const key = teamKey(raw ?? "");
    if (key) keys.add(key);
  }
  return keys;
}

function eventsForTeamVenue(team: VenueTeam, venueEvents: QuizEvent[]): QuizEvent[] {
  if (team.eventSlug && venueEvents.some((event) => event.slug === team.eventSlug)) {
    return venueEvents.filter((event) => event.slug === team.eventSlug);
  }
  return venueEvents;
}

/** Absolvované kvízy v danom podniku: `leagueTable.quizzesPlayed`, inak počet zápisov v `pastResults`. */
export function venueTeamAttendance(team: VenueTeam, venueEvents: QuizEvent[]): number {
  const keys = attendanceNameKeys(team);
  if (keys.size === 0 || venueEvents.length === 0) return 0;

  const events = eventsForTeamVenue(team, venueEvents);

  let fromLeague = 0;
  for (const event of events) {
    for (const row of event.leagueTable ?? []) {
      if (keys.has(teamKey(row.teamName))) {
        fromLeague = Math.max(fromLeague, Number(row.quizzesPlayed) || 0);
      }
    }
  }

  let fromResults = 0;
  for (const event of events) {
    for (const result of event.pastResults ?? []) {
      const detailed = result.teams ?? [];
      if (detailed.length > 0) {
        if (detailed.some((entry) => keys.has(teamKey(entry.teamName)))) fromResults += 1;
        continue;
      }
      if (keys.has(teamKey(result.winnerTeam ?? ""))) fromResults += 1;
    }
  }

  return Math.max(fromLeague, fromResults);
}

/** Most completed quizzes at the venue first; stable name tie-break. */
export function sortVenueTeamsByAttendance(teams: VenueTeam[], venueEvents: QuizEvent[]): VenueTeam[] {
  return teams.slice().sort((a, b) => {
    const byAttendance = venueTeamAttendance(b, venueEvents) - venueTeamAttendance(a, venueEvents);
    if (byAttendance !== 0) return byAttendance;
    return a.teamName.localeCompare(b.teamName, "sk");
  });
}
