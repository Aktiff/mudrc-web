import fs from "fs";
import path from "path";
import { readAppStorageWithFallback, writeAppStorageWithFallback } from "@/lib/app-storage-fallback";
import {
  applyHoldExpiry,
  createTeamBooking,
  createWalkUpSeat,
  markSeatPaid,
  toggleSeatCheckIn,
  type PayBookingStore,
  type PaySeat,
  type PayTeam,
} from "@/lib/pay-domain";

const localPath = path.join(process.cwd(), "src/data/pay-bookings.local.json");
const seedPath = path.join(process.cwd(), "src/data/pay-bookings.json");
const BLOB_NAME = "pay-bookings";

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

async function loadStore(): Promise<PayBookingStore> {
  const data = await readAppStorageWithFallback({
    label: "pay-bookings",
    blobName: BLOB_NAME,
    readLocal: readLocalStore,
    empty: { teams: [] },
  });
  const teams = Array.isArray(data.teams) ? data.teams.map((t) => applyHoldExpiry(t)) : [];
  return { teams };
}

async function persistStore(store: PayBookingStore): Promise<void> {
  await writeAppStorageWithFallback({
    label: "pay-bookings",
    blobName: BLOB_NAME,
    payload: store,
    writeLocal: () => writeLocalStore(store),
  });
}

async function updateStore(mutator: (teams: PayTeam[]) => PayTeam[]): Promise<PayBookingStore> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadStore();
    const nextTeams = mutator(current.teams);
    const next = { teams: nextTeams };
    try {
      await persistStore(next);
      return next;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  return loadStore();
}

export async function readPayTeams(): Promise<PayTeam[]> {
  const { teams } = await loadStore();
  return teams;
}

export async function getTeamByToken(token: string): Promise<PayTeam | null> {
  const teams = await readPayTeams();
  return teams.find((t) => t.token === token) ?? null;
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
  await updateStore((teams) => [...teams, team]);
  return team;
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
