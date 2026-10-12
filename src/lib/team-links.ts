import { teamKey } from "@/lib/poll";

export type TeamLinkRecord = {
  teamName: string;
  linkId?: string;
  venue?: string;
};

function namesForLink(teams: TeamLinkRecord[], linkId: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const team of teams) {
    if (team.linkId !== linkId) continue;
    const name = team.teamName.trim();
    const key = teamKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function groupByName(teams: TeamLinkRecord[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const team of teams) {
    const linkId = team.linkId?.trim();
    const name = team.teamName.trim();
    if (!linkId || !name) continue;
    const names = namesForLink(teams, linkId);
    groups.set(teamKey(name), names);
  }
  return groups;
}

/** K názvom doplní prepojené prezývky, aby sa kvíz nepridelil tým istým ľuďom dvakrát. */
export function expandLinkedTeamNames(names: string[], teams: TeamLinkRecord[]): string[] {
  const groups = groupByName(teams);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const aliases = groups.get(teamKey(name)) ?? [name];
    for (const alias of aliases) {
      const key = teamKey(alias);
      if (!alias.trim() || seen.has(key)) continue;
      seen.add(key);
      out.push(alias.trim());
    }
  }
  return out;
}

/** Názvy z aktuálneho večera, ktoré už kvíz hrali samy alebo pod prepojeným menom. */
export function describeQuizConflicts(
  playedNames: string[],
  filterTeams: string[],
  teams: TeamLinkRecord[]
): string[] {
  const groups = groupByName(teams);
  const playedKeys = new Set(expandLinkedTeamNames(playedNames, teams).map((name) => teamKey(name)));
  const playedDirect = new Set(playedNames.map((name) => teamKey(name)));
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const team of filterTeams) {
    const key = teamKey(team);
    if (!playedKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    const aliases = (groups.get(key) ?? []).filter((name) => teamKey(name) !== key && playedDirect.has(teamKey(name)));
    labels.push(aliases.length ? `${team} (ako ${aliases.join(", ")})` : team);
  }
  return labels;
}
