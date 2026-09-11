import { NextRequest, NextResponse } from "next/server";
import { parsePlayerCount, toSeatPlanSummary } from "@/lib/seat-plan";
import {
  createSeatPlan,
  duplicateStoredSeatPlan,
  readAllSeatPlans,
} from "@/lib/seat-plan-storage";
import { readEvents, readRegistrations } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const eventSlug = req.nextUrl.searchParams.get("eventSlug")?.trim() ?? "";
    const plans = await readAllSeatPlans();
    const filtered = eventSlug ? plans.filter((plan) => plan.eventSlug === eventSlug) : plans;
    return NextResponse.json(
      { plans: filtered.map(toSeatPlanSummary) },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa načítať zasadacie poriadky.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      venue?: string;
      eventSlug?: string;
      date?: string;
      notes?: string;
      fromRegistrations?: boolean;
      duplicateFrom?: string;
      clearReservations?: boolean;
    };

    if (body.duplicateFrom) {
      const copy = await duplicateStoredSeatPlan(body.duplicateFrom, body.clearReservations !== false);
      if (!copy) {
        return NextResponse.json({ error: "Pôvodný zasadací sa nenašiel." }, { status: 404 });
      }
      return NextResponse.json(copy);
    }

    let venue = String(body.venue ?? "").trim();
    let date = String(body.date ?? "").trim();
    let title = String(body.title ?? "").trim();
    const eventSlug = String(body.eventSlug ?? "").trim();
    const teams: { name: string; people: number }[] = [];

    if (eventSlug) {
      const { events } = await readEvents();
      const event = events.find((entry) => entry.slug === eventSlug);
      if (event) {
        venue = venue || event.venue;
        date = date || event.date;
        title = title || `Zasadací — ${event.venue}`;
      }
    }

    if (body.fromRegistrations && eventSlug) {
      const { registrations } = await readRegistrations();
      const venueName = venue.toLowerCase();
      for (const reg of registrations) {
        const matches = reg.eventSlug === eventSlug || (venueName && reg.venue.toLowerCase() === venueName);
        if (!matches) continue;
        teams.push({
          name: reg.teamName,
          people: parsePlayerCount(reg.players) || 4,
        });
      }
    }

    const plan = await createSeatPlan({
      title: title || (venue ? `Zasadací — ${venue}` : "Zasadací poriadok"),
      venue,
      eventSlug,
      date,
      notes: body.notes,
      teams,
    });
    return NextResponse.json(plan);
  } catch (error) {
    console.error("createSeatPlan error:", error);
    const message = error instanceof Error ? error.message : "Nepodarilo sa vytvoriť zasadací poriadok.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
