import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  optionalReadBlob,
  readRegistrations,
  shouldWriteBlob,
  type Registration,
} from "@/lib/storage";
import { readAppStorageBlob, writeAppStorageBlob } from "@/lib/blob-app-storage";
import { extractTeamPhones, type VenueTeam } from "@/lib/venue-team-contact";

export type { VenueTeam } from "@/lib/venue-team-contact";

const BLOB_NAME = "venue-teams";
const LEGACY_BLOB_KEY = "mudrc/venue-teams.json";
const localPath = path.join(process.cwd(), "src/data/venue-teams.local.json");

type Store = { teams: VenueTeam[] };

function teamKey(eventSlug: string, venue: string, teamName: string): string {
  const place = eventSlug.trim().toLowerCase() || venue.trim().toLowerCase();
  return `${place}::${teamName.trim().toLowerCase()}`;
}

function readLocal(): Store {
  try {
    if (!fs.existsSync(localPath)) return { teams: [] };
    const data = JSON.parse(fs.readFileSync(localPath, "utf-8")) as Store;
    return { teams: Array.isArray(data.teams) ? data.teams : [] };
  } catch {
    return { teams: [] };
  }
}

function writeLocal(store: Store) {
  fs.writeFileSync(localPath, JSON.stringify(store, null, 2), "utf-8");
}

async function loadStore(): Promise<Store> {
  const fromBlob = await readAppStorageBlob<Store>(BLOB_NAME);
  if (fromBlob && Array.isArray(fromBlob.teams)) return { teams: fromBlob.teams };
  const legacy = await optionalReadBlob<Store>(LEGACY_BLOB_KEY);
  if (legacy && Array.isArray(legacy.teams)) return { teams: legacy.teams };
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
    if (!next.includes(phone)) next.push(phone);
  }
  return next;
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
      nextPhones.length !== existing.phones.length ||
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
    await saveStore({ teams: Array.from(byKey.values()) });
  }
}

/** Doplní kontakty z aktuálnych registrácií (aj staršie, ešte nezmazané). */
export async function readVenueTeams(): Promise<VenueTeam[]> {
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
  if (removed > 0) await saveStore({ teams: next });
  return removed;
}

export async function deleteVenueTeam(id: string): Promise<boolean> {
  const store = await loadStore();
  const next = store.teams.filter((team) => team.id !== id);
  if (next.length === store.teams.length) return false;
  await saveStore({ teams: next });
  return true;
}
