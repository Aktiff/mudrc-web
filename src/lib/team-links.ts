import type { LeagueEntry } from "@/lib/data";
import { sortLeagueTable } from "@/lib/data";
import { teamKey } from "@/lib/poll";

export type TeamLinkRecord = {
  teamName: string;
  linkId?: string;
  venue?: string;
  leagueMerge?: boolean;
  leagueName?: string;
};

export type LeagueMergeGroup = {
  names: string[];
  displayName: string;
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

/** Skupiny, ktorých body patria v lige do jedného riadku. */
export function leagueMergeGroups(teams: TeamLinkRecord[]): LeagueMergeGroup[] {
  const byLink = new Map<string, TeamLinkRecord[]>();
  for (const team of teams) {
    const linkId = team.linkId?.trim();
    if (!team.leagueMerge || !linkId || !team.teamName.trim()) continue;
    const bucket = byLink.get(linkId) ?? [];
    bucket.push(team);
    byLink.set(linkId, bucket);
  }

  const groups: LeagueMergeGroup[] = [];
  for (const members of Array.from(byLink.values())) {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const member of members) {
      const name = member.teamName.trim();
      const key = teamKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    if (names.length < 2) continue;
    const stored = members.find((member) => member.leagueName?.trim())?.leagueName?.trim() ?? "";
    const primary = names.find((name) => teamKey(name) === teamKey(stored)) ?? names[0];
    groups.push({
      names,
      displayName: stored || primary,
    });
  }
  return groups;
}

/** „Kolektívna Neistota“ a „Kolektívna neistota“ sú jeden tím. Nechá sa zápis s vyšším počtom bodov. */
export function collapseSameTeamSpellings(table: LeagueEntry[]): LeagueEntry[] {
  if (table.length < 2) return table;
  const groups = new Map<string, LeagueEntry[]>();
  const order: string[] = [];
  for (const row of table) {
    const name = row.teamName.trim();
    const key = teamKey(name);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else {
      groups.set(key, [{ ...row, teamName: name }]);
      order.push(key);
    }
  }

  let changed = false;
  const out: LeagueEntry[] = [];
  for (const key of order) {
    const rows = groups.get(key) ?? [];
    if (rows.length < 2) {
      if (rows[0]) out.push(rows[0]);
      continue;
    }
    changed = true;
    const best = [...rows].sort(
      (a, b) => b.points - a.points || b.quizzesPlayed - a.quizzesPlayed || a.teamName.localeCompare(b.teamName, "sk")
    )[0];
    out.push({
      rank: 0,
      teamName: best.teamName,
      points: rows.reduce((sum, row) => sum + row.points, 0),
      quizzesPlayed: rows.reduce((sum, row) => sum + row.quizzesPlayed, 0),
    });
  }
  return changed ? sortLeagueTable(out) : table;
}

/** Sčíta body a počet kvízov zlúčených názvov. Ostatné riadky nechá. */
export function collapseLeagueTable(table: LeagueEntry[], groups: LeagueMergeGroup[]): LeagueEntry[] {
  const folded = collapseSameTeamSpellings(table);
  if (!folded.length || !groups.length) return folded;
  const keyToGroup = new Map<string, LeagueMergeGroup>();
  for (const group of groups) {
    for (const name of group.names) keyToGroup.set(teamKey(name), group);
  }

  const merged = new Map<LeagueMergeGroup, LeagueEntry>();
  const out: LeagueEntry[] = [];
  for (const row of folded) {
    const group = keyToGroup.get(teamKey(row.teamName));
    if (!group) {
      out.push(row);
      continue;
    }
    const prev = merged.get(group);
    if (!prev) {
      const created: LeagueEntry = {
        ...row,
        rank: 0,
        teamName: group.displayName,
        points: row.points,
        quizzesPlayed: row.quizzesPlayed,
      };
      merged.set(group, created);
      out.push(created);
      continue;
    }
    prev.points += row.points;
    prev.quizzesPlayed += row.quizzesPlayed;
  }
  return sortLeagueTable(out);
}
