import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  optionalReadBlob,
  readArchivedRegistrations,
  readRegistrations,
  shouldWriteBlob,
  type Registration,
} from "@/lib/storage";
import { readAppStorageBlob, readAppStorageBlobHistory, writeAppStorageBlob } from "@/lib/blob-app-storage";
import { replaceTeamLabel, teamKey as nameKey } from "@/lib/poll";
import type { TeamLinkRecord } from "@/lib/team-links";
import { extractTeamPhones, type VenueTeam } from "@/lib/venue-team-contact";

export type { VenueTeam } from "@/lib/venue-team-contact";

const BLOB_NAME = "venue-teams";
const LEGACY_BLOB_KEY = "mudrc/venue-teams.json";
const localPath = path.join(process.cwd(), "src/data/venue-teams.local.json");

const PHONE_RECOVERY = 1;

type Store = { teams: VenueTeam[]; phoneRecovery?: number };

function digitKey(value: string): string {
  return value.replace(/\D/g, "");
}

function teamKey(eventSlug: string, venue: string, teamName: string): string {
  const place = eventSlug.trim().toLowerCase() || venue.trim().toLowerCase();
  return `${place}::${teamName.trim().toLowerCase()}`;
}

function readLocal(): Store {
  try {
    if (!fs.existsSync(localPath)) return { teams: [] };
    const data = JSON.parse(fs.readFileSync(localPath, "utf-8")) as Store;
    return {
      teams: Array.isArray(data.teams) ? data.teams : [],
      phoneRecovery: data.phoneRecovery,
    };
  } catch {
    return { teams: [] };
  }
}

function writeLocal(store: Store) {
  fs.writeFileSync(localPath, JSON.stringify(store, null, 2), "utf-8");
}

function asStore(data: Store | null | undefined): Store | null {
  if (!data || !Array.isArray(data.teams)) return null;
  return { teams: data.teams, phoneRecovery: data.phoneRecovery };
}

async function loadStore(): Promise<Store> {
  const fromBlob = asStore(await readAppStorageBlob<Store>(BLOB_NAME));
  if (fromBlob) return fromBlob;
  const legacy = asStore(await optionalReadBlob<Store>(LEGACY_BLOB_KEY));
  if (legacy) return legacy;
  return readLocal();
}

async function saveStore(store: Store): Promise<void> {
  if (shouldWriteBlob()) {
    await writeAppStorageBlob(BLOB_NAME, store);
    return;
  }
  if (process.env.VERCEL) {
    throw new Error("BLOB_NOT_CONFIGURED");
  }
  writeLocal(store);
}

function mergePhones(current: string[], incoming: string[]): string[] {
  const next = [...current];
  for (const phone of incoming) {
    const key = digitKey(phone);
    if (!key) continue;
    const index = next.findIndex((item) => digitKey(item) === key);
    if (index === -1) {
      next.push(phone);
      continue;
    }
    const existing = next[index];
    const existingIsDigits = digitKey(existing) === existing.replace(/\s/g, "");
    const incomingHasNotes = phone.replace(/[\d\s]/g, "").length > 0;
    if (existingIsDigits && incomingHasNotes) next[index] = phone;
  }
  return next;
}

function samePhones(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((phone, index) => phone === right[index]);
}

export async function rememberTeamsFromRegistrations(regs: Registration[]): Promise<VenueTeam[]> {
  const store = await loadStore();
  const useful = regs.filter((reg) => reg.teamName?.trim() && (reg.eventSlug?.trim() || reg.venue?.trim()));
  if (!useful.length) return store.teams;

  const byKey = new Map(store.teams.map((team) => [teamKey(team.eventSlug, team.venue, team.teamName), team]));
  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
  let changed = false;

  for (const reg of useful) {
    const key = teamKey(reg.eventSlug ?? "", reg.venue ?? "", reg.teamName);
    const phones = extractTeamPhones(reg.phone ?? "");
    const existing = byKey.get(key);
    if (!existing) {
      const created: VenueTeam = {
        id: randomUUID(),
        eventSlug: reg.eventSlug ?? "",
        venue: reg.venue ?? "",
        teamName: reg.teamName.trim(),
        phones,
        updatedAt: now,
      };
      byKey.set(key, created);
      changed = true;
      continue;
    }
    const nextPhones = mergePhones(existing.phones, phones);
    if (
      !samePhones(nextPhones, existing.phones) ||
      existing.teamName !== reg.teamName.trim() ||
      existing.venue !== (reg.venue ?? existing.venue)
    ) {
      existing.phones = nextPhones;
      existing.teamName = reg.teamName.trim();
      existing.venue = reg.venue?.trim() || existing.venue;
      existing.eventSlug = reg.eventSlug?.trim() || existing.eventSlug;
      existing.updatedAt = now;
      changed = true;
    }
  }

  const teams = Array.from(byKey.values());
  if (changed) {
    await saveStore({ teams, phoneRecovery: store.phoneRecovery });
  }
  return teams;
}

function venueNameKey(venue: string, teamName: string): string {
  return `${venue.trim().toLowerCase()}::${teamName.trim().toLowerCase()}`;
}

function teamsByVenueName(teams: VenueTeam[]): Map<string, VenueTeam> {
  const map = new Map<string, VenueTeam>();
  for (const team of teams) {
    if (!team.venue?.trim() || !team.teamName?.trim()) continue;
    map.set(venueNameKey(team.venue, team.teamName), team);
  }
  return map;
}

/** Doplní čísla k tímom, ktoré už v zozname sú. Zmazaný tím sa nevracia. */
function fillExistingTeamPhones(teams: VenueTeam[], regs: Registration[], now: string): VenueTeam[] {
  const byVenue = teamsByVenueName(teams);
  const byKey = new Map(teams.map((team) => [teamKey(team.eventSlug, team.venue, team.teamName), team]));
  for (const reg of regs) {
    if (!reg.teamName?.trim()) continue;
    const phones = extractTeamPhones(reg.phone ?? "");
    if (!phones.length) continue;
    const existing =
      (reg.venue?.trim() ? byVenue.get(venueNameKey(reg.venue, reg.teamName)) : undefined) ??
      byKey.get(teamKey(reg.eventSlug ?? "", reg.venue ?? "", reg.teamName));
    if (!existing) continue;
    const nextPhones = mergePhones(existing.phones, phones);
    if (!samePhones(nextPhones, existing.phones)) {
      existing.phones = nextPhones;
      existing.updatedAt = now;
    }
  }
  return teams;
}

/** Raz prejde staršie registrácie a staršie súbory tímov a vráti čísla, ktoré filter predtým zahodil. */
async function recoverStoredPhones(): Promise<void> {
  const store = await loadStore();
  if (store.phoneRecovery === PHONE_RECOVERY) return;

  const archived = await readArchivedRegistrations();
  const history = await readAppStorageBlobHistory<Store>(BLOB_NAME);
  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
  const historicalRegs: Registration[] = history.flatMap((entry) =>
    (entry.teams ?? [])
      .filter((team) => team.teamName?.trim() && team.phones?.length)
      .map((team) => ({
        id: team.id,
        eventSlug: team.eventSlug,
        venue: team.venue,
        teamName: team.teamName,
        players: "",
        phone: team.phones.join(", "),
        createdAt: team.updatedAt,
      }))
  );
  const teams = fillExistingTeamPhones(store.teams, [...archived, ...historicalRegs], now);
  await saveStore({ teams, phoneRecovery: PHONE_RECOVERY });
}

/** Doplní kontakty z aktuálnych registrácií (aj staršie, ešte nezmazané). */
export async function readVenueTeams(): Promise<VenueTeam[]> {
  try {
    await recoverStoredPhones();
  } catch (error) {
    console.error("team phone recovery failed:", error);
  }
  let registrations: Registration[] = [];
  try {
    registrations = (await readRegistrations()).registrations;
  } catch (error) {
    console.error("current registrations for teams failed:", error);
  }
  const teams = await rememberTeamsFromRegistrations(registrations);
  return teams.slice().sort((a, b) => a.teamName.localeCompare(b.teamName, "sk"));
}

export async function deleteVenueTeamsForPlace(eventSlug: string, venue: string): Promise<number> {
  const venueLower = venue.trim().toLowerCase();
  const store = await loadStore();
  const next = store.teams.filter((team) => {
    if (eventSlug && team.eventSlug === eventSlug) return false;
    if (venueLower && team.venue.trim().toLowerCase() === venueLower) return false;
    return true;
  });
  const removed = store.teams.length - next.length;
  if (removed > 0) await saveStore({ teams: next, phoneRecovery: store.phoneRecovery });
  return removed;
}

export async function deleteVenueTeam(id: string): Promise<boolean> {
  const store = await loadStore();
  const target = store.teams.find((team) => team.id === id);
  if (!target) return false;
  const next = normalizeLeagueGroups(store.teams.filter((team) => team.id !== id));
  await saveStore({ teams: next, phoneRecovery: store.phoneRecovery });
  return true;
}

/** Len prepojenia, bez dopĺňania telefónov. Používa verejná liga. */
export async function readTeamLinkRecords(): Promise<TeamLinkRecord[]> {
  const store = await loadStore();
  return store.teams.map((team) => ({
    teamName: team.teamName,
    linkId: team.linkId,
    venue: team.venue,
    leagueMerge: team.leagueMerge,
    leagueName: team.leagueName,
  }));
}

function normalizeLeagueGroups(teams: VenueTeam[]): VenueTeam[] {
  const byLink = new Map<string, VenueTeam[]>();
  for (const team of teams) {
    const linkId = team.linkId?.trim();
    if (!linkId) continue;
    const bucket = byLink.get(linkId) ?? [];
    bucket.push(team);
    byLink.set(linkId, bucket);
  }

  const dropLink = new Set<string>();
  const clearMerge = new Set<string>();
  const leagueNameByLink = new Map<string, string>();
  for (const [linkId, members] of Array.from(byLink.entries())) {
    if (members.length < 2) {
      dropLink.add(linkId);
      continue;
    }
    const merged = members.filter((team) => team.leagueMerge);
    const distinct = new Set(merged.map((team) => nameKey(team.teamName)));
    if (distinct.size < 2) {
      clearMerge.add(linkId);
      continue;
    }
    const stored = merged.find((team) => team.leagueName?.trim())?.leagueName?.trim() ?? "";
    const primary = merged.find((team) => nameKey(team.teamName) === nameKey(stored))?.teamName ?? merged[0].teamName;
    leagueNameByLink.set(linkId, (stored || primary).trim());
  }

  return teams.map((team) => {
    const linkId = team.linkId?.trim();
    if (!linkId || dropLink.has(linkId)) {
      if (team.linkId || team.leagueMerge || team.leagueName) {
        return { ...team, linkId: undefined, leagueMerge: undefined, leagueName: undefined };
      }
      return team;
    }
    if (clearMerge.has(linkId)) {
      if (team.leagueMerge || team.leagueName) {
        return { ...team, leagueMerge: undefined, leagueName: undefined };
      }
      return team;
    }
    const leagueName = leagueNameByLink.get(linkId);
    if (team.leagueMerge && leagueName && team.leagueName !== leagueName) {
      return { ...team, leagueName };
    }
    return team;
  });
}

function stampTeams(teams: VenueTeam[]): VenueTeam[] {
  return teams.sort((a, b) => a.teamName.localeCompare(b.teamName, "sk"));
}

/** Spojí dva záznamy tímov. Ľudia s prepojeným názvom nedostanú ten istý kvíz. */
export async function linkVenueTeams(
  teamId: string,
  otherTeamId: string,
  mode: "quiz" | "full" = "quiz"
): Promise<VenueTeam[]> {
  if (!teamId || !otherTeamId || teamId === otherTeamId) {
    throw new Error("Vyber dva rôzne tímy.");
  }
  const store = await loadStore();
  const left = store.teams.find((team) => team.id === teamId);
  const right = store.teams.find((team) => team.id === otherTeamId);
  if (!left || !right) throw new Error("Tím sa nenašiel.");
  if (mode === "full" && nameKey(left.teamName) === nameKey(right.teamName)) {
    throw new Error("V lige treba spojiť dva rôzne názvy.");
  }

  const linkId = left.linkId || right.linkId || randomUUID();
  const previous = new Set([left.linkId, right.linkId].filter((id): id is string => Boolean(id)));
  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
  const leagueName = left.teamName.trim();
  const teams = normalizeLeagueGroups(
    store.teams.map((team) => {
      const joins = team.id === left.id || team.id === right.id || (team.linkId && previous.has(team.linkId));
      if (!joins) return team;
      if (mode === "full") return { ...team, linkId, leagueMerge: true, leagueName, updatedAt: now };
      return { ...team, linkId, updatedAt: now };
    })
  );
  await saveStore({ teams, phoneRecovery: store.phoneRecovery });
  return stampTeams(teams);
}

/** Už prepojené názvy začnú v lige počítať body ako jeden tím. Hlavný názov je ten, z ktorého sa zlúčenie spustí. */
export async function mergeLinkedTeamLeague(teamId: string): Promise<VenueTeam[]> {
  const store = await loadStore();
  const target = store.teams.find((team) => team.id === teamId);
  if (!target) throw new Error("Tím sa nenašiel.");
  if (!target.linkId) throw new Error("Najprv tím s niekým prepoj, alebo vyber druhý názov.");
  const names = new Set(
    store.teams.filter((team) => team.linkId === target.linkId).map((team) => nameKey(team.teamName))
  );
  if (names.size < 2) throw new Error("Na zlúčenie v lige treba dva rôzne názvy.");

  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
  const leagueName = target.teamName.trim();
  const teams = normalizeLeagueGroups(
    store.teams.map((team) =>
      team.linkId === target.linkId ? { ...team, leagueMerge: true, leagueName, updatedAt: now } : team
    )
  );
  await saveStore({ teams, phoneRecovery: store.phoneRecovery });
  return stampTeams(teams);
}

export async function venueTeamNameById(teamId: string): Promise<string | null> {
  const store = await loadStore();
  const team = store.teams.find((item) => item.id === teamId);
  return team?.teamName?.trim() || null;
}

/** Úplne prepíše názov tímu v zozname. Rovnaký názov v jednom podniku sa zloží do jedného záznamu. */
export async function renameVenueTeamRecords(fromKey: string, nextName: string): Promise<void> {
  const store = await loadStore();
  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
  const renamed = store.teams.map((team) => {
    const teamName = replaceTeamLabel(team.teamName, fromKey, nextName);
    const leagueName = team.leagueName ? replaceTeamLabel(team.leagueName, fromKey, nextName) : team.leagueName;
    if (teamName === team.teamName && leagueName === team.leagueName) return team;
    return { ...team, teamName, leagueName, updatedAt: now };
  });
  const merged = new Map<string, VenueTeam>();
  for (const team of renamed) {
    const key = teamKey(team.eventSlug, team.venue, team.teamName);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, team);
      continue;
    }
    merged.set(key, {
      ...prev,
      phones: mergePhones(prev.phones, team.phones),
      linkId: prev.linkId || team.linkId,
      leagueMerge: prev.leagueMerge || team.leagueMerge || undefined,
      leagueName: prev.leagueName || team.leagueName,
      updatedAt: now,
    });
  }
  await saveStore({ teams: Array.from(merged.values()), phoneRecovery: store.phoneRecovery });
}

/** Vlastný názov spoločného tímu v lige. Pôvodné mená z večerov ostanú. */
export async function renameLeagueGroup(teamName: string, leagueName: string): Promise<VenueTeam[]> {
  const label = leagueName.trim();
  if (!label) throw new Error("Názov nemôže byť prázdny.");
  const store = await loadStore();
  const key = nameKey(teamName);
  const target = store.teams.find(
    (team) =>
      team.leagueMerge &&
      team.linkId &&
      (nameKey(team.teamName) === key || nameKey(team.leagueName ?? "") === key)
  );
  if (!target?.linkId) throw new Error("Tento tím nie je zlúčený v lige.");
  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
  const teams = store.teams.map((team) =>
    team.linkId === target.linkId && team.leagueMerge ? { ...team, leagueName: label, updatedAt: now } : team
  );
  await saveStore({ teams, phoneRecovery: store.phoneRecovery });
  return stampTeams(teams);
}

/** V ligovej tabuľke sa zlúčená skupina ukáže pod názvom tohto tímu. */
export async function setLeagueDisplayName(teamId: string): Promise<VenueTeam[]> {
  const store = await loadStore();
  const target = store.teams.find((team) => team.id === teamId);
  if (!target?.linkId || !target.leagueMerge) throw new Error("Tento tím nie je zlúčený v lige.");
  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
  const leagueName = target.teamName.trim();
  const teams = store.teams.map((team) =>
    team.linkId === target.linkId && team.leagueMerge ? { ...team, leagueName, updatedAt: now } : team
  );
  await saveStore({ teams, phoneRecovery: store.phoneRecovery });
  return stampTeams(teams);
}

/** Doplní číslo, ktoré sa zistilo neskôr. Existujúce čísla ostanú. */
export async function addVenueTeamPhone(teamId: string, rawPhone: string): Promise<VenueTeam[]> {
  const incoming = extractTeamPhones(rawPhone);
  if (!incoming.length) throw new Error("Zadaj telefónne číslo. Prázdne pole a samé nuly sa neuložia.");
  const store = await loadStore();
  const target = store.teams.find((team) => team.id === teamId);
  if (!target) throw new Error("Tím sa nenašiel.");
  const nextPhones = mergePhones(target.phones, incoming);
  if (samePhones(nextPhones, target.phones)) throw new Error("Toto číslo už tím má.");
  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
  const teams = store.teams.map((team) =>
    team.id === teamId ? { ...team, phones: nextPhones, updatedAt: now } : team
  );
  await saveStore({ teams, phoneRecovery: store.phoneRecovery });
  return stampTeams(teams);
}

export async function unlinkVenueTeam(teamId: string): Promise<VenueTeam[]> {
  const store = await loadStore();
  const target = store.teams.find((team) => team.id === teamId);
  if (!target) throw new Error("Tím sa nenašiel.");
  const teams = normalizeLeagueGroups(
    store.teams.map((team) =>
      team.id === teamId ? { ...team, linkId: undefined, leagueMerge: undefined, leagueName: undefined } : team
    )
  );
  await saveStore({ teams, phoneRecovery: store.phoneRecovery });
  return stampTeams(teams);
}
