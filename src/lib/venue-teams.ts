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

export async function rememberTeamsFromRegistrations(regs: Registration[]): Promise<void> {
  const useful = regs.filter((reg) => reg.teamName?.trim() && (reg.eventSlug?.trim() || reg.venue?.trim()));
  if (!useful.length) return;

  const store = await loadStore();
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

  if (changed) {
    await saveStore({ teams: Array.from(byKey.values()), phoneRecovery: store.phoneRecovery });
  }
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
  const { registrations } = await readRegistrations();
  await rememberTeamsFromRegistrations(registrations);
  const store = await loadStore();
  return store.teams.sort((a, b) => a.teamName.localeCompare(b.teamName, "sk"));
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
  const next = store.teams.filter((team) => team.id !== id);
  if (next.length === store.teams.length) return false;
  await saveStore({ teams: next, phoneRecovery: store.phoneRecovery });
  return true;
}
