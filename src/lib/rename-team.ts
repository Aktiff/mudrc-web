import { sortLeagueTable, type LeagueEntry, type QuizEvent } from "@/lib/data";
import { normalizeTeamName, replaceTeamLabel, teamKey } from "@/lib/poll";
import { renameTeamInPollVotes } from "@/lib/poll-storage";
import { renameTeamInSeatPlans } from "@/lib/seat-plan-storage";
import { readRegistrations, renameTeamInStoredQuizzes, updateEvents, updateRegistrations } from "@/lib/storage";
import { readVenueTeams, renameVenueTeamRecords, venueTeamNameById, type VenueTeam } from "@/lib/venue-teams";

function renameLeagueRows(table: LeagueEntry[], fromKey: string, nextName: string): LeagueEntry[] {
  const renamed = table.map((row) =>
    teamKey(row.teamName) === fromKey ? { ...row, teamName: nextName } : row
  );
  const nextKey = teamKey(nextName);
  const matches = renamed.filter((row) => teamKey(row.teamName) === nextKey);
  if (matches.length < 2) return renamed;
  const combined: LeagueEntry = {
    rank: 0,
    teamName: nextName,
    points: matches.reduce((sum, row) => sum + row.points, 0),
    quizzesPlayed: matches.reduce((sum, row) => sum + row.quizzesPlayed, 0),
  };
  let placed = false;
  const out: LeagueEntry[] = [];
  for (const row of renamed) {
    if (teamKey(row.teamName) !== nextKey) {
      out.push(row);
      continue;
    }
    if (!placed) {
      out.push(combined);
      placed = true;
    }
  }
  return sortLeagueTable(out);
}

function eventMentionsTeam(event: QuizEvent, fromKey: string): boolean {
  if ((event.leagueTable ?? []).some((row) => teamKey(row.teamName) === fromKey)) return true;
  return (event.pastResults ?? []).some(
    (result) =>
      teamKey(result.winnerTeam ?? "") === fromKey ||
      (result.teams ?? []).some(
        (team) =>
          teamKey(team.teamName) === fromKey || (team.guestTeams ?? []).some((guest) => teamKey(guest) === fromKey)
      )
  );
}

function renameEventTeam(event: QuizEvent, fromKey: string, nextName: string): QuizEvent {
  const leagueTable = renameLeagueRows(event.leagueTable ?? [], fromKey, nextName);
  const pastResults = (event.pastResults ?? []).map((result) => ({
    ...result,
    winnerTeam: replaceTeamLabel(result.winnerTeam ?? "", fromKey, nextName),
    teams: result.teams?.map((team) => {
      const teamName = replaceTeamLabel(team.teamName, fromKey, nextName);
      const guestTeams = team.guestTeams?.map((guest) => replaceTeamLabel(guest, fromKey, nextName));
      const guestChanged = guestTeams?.some((guest, index) => guest !== team.guestTeams?.[index]) ?? false;
      if (teamName === team.teamName && !guestChanged) return team;
      return { ...team, teamName, ...(guestTeams ? { guestTeams } : {}) };
    }),
  }));
  return { ...event, leagueTable, pastResults };
}

/** Partizánske sa všade stane Baťovka: liga, výsledky, registrácie, zasadací poriadok aj hlasy. */
export async function renameTeamEverywhere(teamId: string, nextNameRaw: string): Promise<VenueTeam[]> {
  const nextName = normalizeTeamName(nextNameRaw);
  if (!nextName) throw new Error("Názov nemôže byť prázdny.");
  if (nextName.length > 80) throw new Error("Názov je pridlhý.");

  const currentName = await venueTeamNameById(teamId);
  if (!currentName) throw new Error("Tím sa nenašiel.");
  const fromKey = teamKey(currentName);
  if (!fromKey || fromKey === teamKey(nextName)) throw new Error("Nový názov je rovnaký.");

  await renameTeamInStoredQuizzes(fromKey, nextName);
  await updateEvents((events) =>
    events.map((event) => (eventMentionsTeam(event, fromKey) ? renameEventTeam(event, fromKey, nextName) : event))
  );

  const { registrations } = await readRegistrations();
  if (registrations.some((reg) => teamKey(reg.teamName) === fromKey)) {
    await updateRegistrations((regs) =>
      regs.map((reg) => {
        const teamName = replaceTeamLabel(reg.teamName, fromKey, nextName);
        return teamName === reg.teamName ? reg : { ...reg, teamName };
      })
    );
  }

  await renameVenueTeamRecords(fromKey, nextName);
  await renameTeamInSeatPlans(fromKey, nextName);
  await renameTeamInPollVotes(fromKey, nextName);
  return readVenueTeams();
}
