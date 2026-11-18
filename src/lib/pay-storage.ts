import fs from "fs";
import path from "path";
import { readAppStorageWithFallback, writeAppStorageWithFallback } from "@/lib/app-storage-fallback";
import { readLatestAppStorageBlob } from "@/lib/blob-app-storage";
import { hasBlobStorage } from "@/lib/storage";
import {
  addPrepaidSeat,
  applyHoldExpiry,
  cancelTeamBooking,
  createTeamBooking,
  createWalkUpSeat,
  markNextPendingSeatsPaid,
  markSeatPaid,
  toggleSeatCheckIn,
  type PayBookingStore,
  type PaySeat,
  type PayTeam,
} from "@/lib/pay-domain";
import { PAY_TEST_EVENT_SLUG } from "@/lib/pay-test-event";

/** Keep in sync with `PAY_STAGING_DEMO_SLUG` in pay-events (avoid circular import). */
const PAY_STAGING_DEMO_SLUG = "pay-staging-demo";

const localPath = path.join(process.cwd(), "src/data/pay-bookings.local.json");
const seedPath = path.join(process.cwd(), "src/data/pay-bookings.json");
const BLOB_NAME = "pay-bookings";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readLocalStore(): PayBookingStore {
  try {
    const file = fs.existsSync(localPath) ? localPath : seedPath;
    if (!fs.existsSync(file)) return { teams: [] };
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as PayBookingStore;
    return { teams: Array.isArray(raw.teams) ? raw.teams : [] };
  } catch {
    return { teams: [] };
  }
}

function writeLocalStore(store: PayBookingStore): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(store, null, 2), "utf-8");
}

function normalizeStore(data: PayBookingStore | null | undefined): PayBookingStore {
  const teams = Array.isArray(data?.teams) ? data!.teams.map((t) => applyHoldExpiry(t)) : [];
  return { teams };
}

/**
 * Prefer version-list read (avoids stale CDN pointer that caused immediate 404
 * after register on Vercel). Fall back to pointer / local seed.
 */
async function loadStore(): Promise<PayBookingStore> {
  if (hasBlobStorage()) {
    try {
      const latest = await readLatestAppStorageBlob<PayBookingStore>(BLOB_NAME);
      if (latest && Array.isArray(latest.teams)) {
        return normalizeStore(latest);
      }
    } catch (error) {
      console.error("pay-bookings latest read failed:", error);
    }
  }

  const data = await readAppStorageWithFallback({
    label: "pay-bookings",
    blobName: BLOB_NAME,
    readLocal: readLocalStore,
    empty: { teams: [] },
  });
  return normalizeStore(data);
}

async function persistStore(store: PayBookingStore): Promise<void> {
  await writeAppStorageWithFallback({
    label: "pay-bookings",
    blobName: BLOB_NAME,
    payload: store,
    writeLocal: () => writeLocalStore(store),
  });
}

/** Merge by team id so concurrent registers don't wipe each other. */
function mergeTeams(base: PayTeam[], next: PayTeam[]): PayTeam[] {
  const byId = new Map<string, PayTeam>();
  for (const team of base) byId.set(team.id, team);
  for (const team of next) byId.set(team.id, team);
  return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function updateStore(mutator: (teams: PayTeam[]) => PayTeam[]): Promise<PayBookingStore> {
  let last: PayBookingStore = { teams: [] };
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await loadStore();
    const mutated = mutator(current.teams);
    // Re-read once more and merge — reduces lost updates under concurrent writes.
    const fresh = await loadStore();
    const merged = mergeTeams(fresh.teams, mutated);
    const next = { teams: merged };
    try {
      await persistStore(next);
      last = next;
      // Confirm the written version is listable (Blob can lag a few hundred ms).
      if (hasBlobStorage()) {
        await sleep(150 * (attempt + 1));
        const verified = await loadStore();
        const missing = mutated.filter((t) => !verified.teams.some((v) => v.id === t.id));
        if (missing.length === 0) return verified;
        last = { teams: mergeTeams(verified.teams, mutated) };
        continue;
      }
      return next;
    } catch (error) {
      if (attempt === 7) throw error;
      await sleep(200 * (attempt + 1));
    }
  }
  return last;
}

export async function readPayTeams(): Promise<PayTeam[]> {
  const { teams } = await loadStore();
  return teams;
}

/** Resolve team; retries briefly because Vercel Blob listing can lag after write. */
export async function getTeamByToken(
  token: string,
  options?: { retries?: number; delayMs?: number }
): Promise<PayTeam | null> {
  const retries = options?.retries ?? 8;
  const delayMs = options?.delayMs ?? 250;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const teams = await readPayTeams();
    const found = teams.find((t) => t.token === token) ?? null;
    if (found) return found;
    if (attempt < retries) await sleep(delayMs * (attempt + 1));
  }
  return null;
}

export async function getTeamById(id: string): Promise<PayTeam | null> {
  const teams = await readPayTeams();
  return teams.find((t) => t.id === id) ?? null;
}

export async function findSeatByToken(
  seatToken: string
): Promise<{ team: PayTeam; seat: PaySeat } | null> {
  const teams = await readPayTeams();
  for (const team of teams) {
    const seat = team.seats.find((s) => s.token === seatToken);
    if (seat) return { team, seat };
  }
  return null;
}

export async function registerPayTeam(
  input: Parameters<typeof createTeamBooking>[0]
): Promise<PayTeam> {
  const team = createTeamBooking(input);
  await updateStore((teams) => {
    if (teams.some((t) => t.id === team.id || t.token === team.token)) return teams;
    return [...teams, team];
  });

  // Don't return until the team is readable on a fresh load (fixes www.mudrc.sk/pay 404).
  const visible = await getTeamByToken(team.token, { retries: 12, delayMs: 200 });
  return visible ?? team;
}

export async function paySeatMock(
  seatToken: string,
  payer?: { name?: string; email?: string }
): Promise<{ team: PayTeam; seat: PaySeat } | { error: string; status: number }> {
  let paid: { team: PayTeam; seat: PaySeat } | undefined;
  let fail: string | undefined;
  await updateStore((teams) => {
    const idx = teams.findIndex((t) => t.seats.some((s) => s.token === seatToken));
    if (idx < 0) {
      fail = "Lístok neexistuje.";
      return teams;
    }
    const outcome = markSeatPaid(teams[idx], seatToken, payer);
    if ("error" in outcome) {
      fail = outcome.error;
      return teams;
    }
    paid = outcome;
    const next = [...teams];
    next[idx] = outcome.team;
    return next;
  });
  if (fail) return { error: fail, status: 400 };
  if (!paid) return { error: "Platba zlyhala.", status: 500 };
  return paid;
}

/** Pay one seat via the shared team link (claims next pending prepaid seat). */
export async function payTeamNextSeatMock(
  teamToken: string,
  payer?: { name?: string; email?: string }
): Promise<{ team: PayTeam; seat: PaySeat } | { error: string; status: number }> {
  const result = await payTeamSeatsMock(teamToken, 1, payer);
  if ("error" in result) return result;
  return { team: result.team, seat: result.seats[0] };
}

/** Pay N seats via the shared team link (claims next N pending prepaid seats). */
export async function payTeamSeatsMock(
  teamToken: string,
  quantity: number,
  payer?: { name?: string; email?: string }
): Promise<{ team: PayTeam; seats: PaySeat[] } | { error: string; status: number }> {
  let paid: { team: PayTeam; seats: PaySeat[] } | undefined;
  let fail: string | undefined;
  await updateStore((teams) => {
    const idx = teams.findIndex((t) => t.token === teamToken);
    if (idx < 0) {
      fail = "Tím neexistuje.";
      return teams;
    }
    const outcome = markNextPendingSeatsPaid(teams[idx], quantity, payer);
    if ("error" in outcome) {
      fail = outcome.error;
      return teams;
    }
    paid = outcome;
    const next = [...teams];
    next[idx] = outcome.team;
    return next;
  });
  if (fail) return { error: fail, status: 400 };
  if (!paid) return { error: "Platba zlyhala.", status: 500 };
  return paid;
}

export async function addTeamSeat(
  teamToken: string,
  maxPlayers: number,
  entryFee: number
): Promise<{ team: PayTeam; seat: PaySeat } | { error: string; status: number }> {
  let added: { team: PayTeam; seat: PaySeat } | undefined;
  let fail: string | undefined;
  await updateStore((teams) => {
    const idx = teams.findIndex((t) => t.token === teamToken);
    if (idx < 0) {
      fail = "Tím neexistuje.";
      return teams;
    }
    const outcome = addPrepaidSeat(teams[idx], maxPlayers, entryFee);
    if ("error" in outcome) {
      fail = outcome.error;
      return teams;
    }
    added = outcome;
    const next = [...teams];
    next[idx] = outcome.team;
    return next;
  });
  if (fail) return { error: fail, status: 400 };
  if (!added) return { error: "Miesto sa nepodarilo pridať.", status: 500 };
  return added;
}

export async function createAndPayWalkUp(input: {
  eventSlug: string;
  venue: string;
  city?: string;
  quizDate: string;
  quizTime: string;
  entryFee: number;
  name: string;
  email?: string;
  phone?: string;
}): Promise<{ team: PayTeam; seat: PaySeat }> {
  const { team, seat } = createWalkUpSeat(input, {
    name: input.name,
    email: input.email,
    phone: input.phone,
  });
  const paid = markSeatPaid(team, seat.token, { name: input.name, email: input.email });
  if ("error" in paid) throw new Error(paid.error);
  await updateStore((teams) => [...teams, paid.team]);
  return paid;
}

export async function setSeatCheckIn(
  teamId: string,
  seatId: string
): Promise<PayTeam | null> {
  let updated: PayTeam | null = null;
  await updateStore((teams) => {
    const idx = teams.findIndex((t) => t.id === teamId);
    if (idx < 0) return teams;
    const nextTeam = toggleSeatCheckIn(teams[idx], seatId);
    if (!nextTeam) return teams;
    updated = nextTeam;
    const next = [...teams];
    next[idx] = nextTeam;
    return next;
  });
  return updated;
}

export async function teamsForEvent(eventSlug: string, quizDate?: string): Promise<PayTeam[]> {
  const teams = await readPayTeams();
  return teams.filter((t) => {
    if (t.eventSlug !== eventSlug) return false;
    if (quizDate && t.quizDate !== quizDate) return false;
    return true;
  });
}

/** Slugs where mock/staging pay traffic is allowed to appear in admin. */
export function isPayStagingEventSlug(eventSlug: string): boolean {
  return eventSlug === PAY_TEST_EVENT_SLUG || eventSlug === PAY_STAGING_DEMO_SLUG;
}

export async function cancelPayTeamById(id: string): Promise<PayTeam | null> {
  let cancelled: PayTeam | null = null;
  await updateStore((teams) => {
    const idx = teams.findIndex((t) => t.id === id);
    if (idx < 0) return teams;
    const nextTeam = cancelTeamBooking(teams[idx]);
    cancelled = nextTeam;
    const next = [...teams];
    next[idx] = nextTeam;
    return next;
  });
  return cancelled;
}

export async function cancelPayTeamsByIds(ids: string[]): Promise<number> {
  const idSet = new Set(ids.filter(Boolean));
  if (idSet.size === 0) return 0;
  let removed = 0;
  await updateStore((teams) =>
    teams.map((team) => {
      if (!idSet.has(team.id) || team.status === "cancelled") return team;
      removed += 1;
      return cancelTeamBooking(team);
    })
  );
  return removed;
}

/**
 * Mock/staging pay bookings must not pollute real venue admin lists.
 * Cancels mock teams attached to any slug other than the dedicated test/demo events.
 */
export async function scrubStrayMockPayTeamsOffRealEvents(): Promise<number> {
  let cancelled = 0;
  await updateStore((teams) =>
    teams.map((team) => {
      if (team.status === "cancelled") return team;
      if (!team.mock) return team;
      if (isPayStagingEventSlug(team.eventSlug)) return team;
      cancelled += 1;
      return cancelTeamBooking(team);
    })
  );
  return cancelled;
}
