import fs from "fs";
import path from "path";
import {
  duplicateSeatPlan,
  emptySeatPlan,
  layoutTablesFromTeams,
  normalizeSeatPlan,
  type SeatPlan,
  type SeatTeamInput,
} from "@/lib/seat-plan";
import {
  hasSupabaseStorage,
  supabaseFetchSeatPlans,
  supabaseSetSeatPlans,
} from "@/lib/supabase-storage";

const localPath = path.join(process.cwd(), "src/data/seat-plans.local.json");

type SeatPlanStore = { plans: SeatPlan[] };

function readLocalPlans(): SeatPlanStore {
  try {
    if (!fs.existsSync(localPath)) return { plans: [] };
    const raw = fs.readFileSync(localPath, "utf-8");
    const data = JSON.parse(raw) as SeatPlanStore;
    const plans = Array.isArray(data.plans)
      ? data.plans.map(normalizeSeatPlan).filter((plan): plan is SeatPlan => plan !== null)
      : [];
    return { plans };
  } catch {
    return { plans: [] };
  }
}

function writeLocalPlans(store: SeatPlanStore): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(store, null, 2), "utf-8");
}

async function loadAllPlans(): Promise<SeatPlan[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchSeatPlans();
    if (result.status === "ok") {
      return (result.value.plans ?? [])
        .map(normalizeSeatPlan)
        .filter((plan): plan is SeatPlan => plan !== null);
    }
    if (result.status === "error") {
      throw new Error(`Nepodarilo sa načítať zasadacie poriadky: ${result.message}`);
    }
    return [];
  }
  return readLocalPlans().plans;
}

async function persistAllPlans(plans: SeatPlan[]): Promise<void> {
  if (hasSupabaseStorage()) {
    await supabaseSetSeatPlans({ plans });
    return;
  }
  writeLocalPlans({ plans });
}

export async function readAllSeatPlans(): Promise<SeatPlan[]> {
  const plans = await loadAllPlans();
  return plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readSeatPlan(id: string): Promise<SeatPlan | null> {
  const plans = await loadAllPlans();
  return plans.find((plan) => plan.id === id) ?? null;
}

export async function readSeatPlanByToken(token: string): Promise<SeatPlan | null> {
  const plans = await loadAllPlans();
  return plans.find((plan) => plan.shareToken === token) ?? null;
}

export async function createSeatPlan(input: {
  title?: string;
  venue?: string;
  eventSlug?: string;
  date?: string;
  notes?: string;
  teams?: SeatTeamInput[];
}): Promise<SeatPlan> {
  const plan = emptySeatPlan({
    title: input.title,
    venue: input.venue,
    eventSlug: input.eventSlug,
    date: input.date,
    notes: input.notes,
  });
  if (input.teams && input.teams.length > 0) {
    plan.tables = layoutTablesFromTeams(input.teams);
  }
  const plans = await loadAllPlans();
  plans.push(plan);
  await persistAllPlans(plans);
  return plan;
}

export async function saveSeatPlan(incoming: SeatPlan): Promise<SeatPlan> {
  const normalized = normalizeSeatPlan({ ...incoming, updatedAt: new Date().toISOString() });
  if (!normalized) throw new Error("Neplatný zasadací poriadok.");
  const plans = await loadAllPlans();
  const idx = plans.findIndex((plan) => plan.id === normalized.id);
  const next = [...plans];
  if (idx === -1) next.push(normalized);
  else {
    next[idx] = {
      ...normalized,
      shareToken: plans[idx].shareToken,
      createdAt: plans[idx].createdAt,
    };
  }
  await persistAllPlans(next);
  return next[idx === -1 ? next.length - 1 : idx];
}

export async function duplicateStoredSeatPlan(id: string, clearReservations: boolean): Promise<SeatPlan | null> {
  const plans = await loadAllPlans();
  const source = plans.find((plan) => plan.id === id);
  if (!source) return null;
  const copy = duplicateSeatPlan(source, clearReservations);
  plans.push(copy);
  await persistAllPlans(plans);
  return copy;
}

export async function deleteSeatPlan(id: string): Promise<boolean> {
  const plans = await loadAllPlans();
  const next = plans.filter((plan) => plan.id !== id);
  if (next.length === plans.length) return false;
  await persistAllPlans(next);
  return true;
}
