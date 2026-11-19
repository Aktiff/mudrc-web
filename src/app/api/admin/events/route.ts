import { NextRequest, NextResponse } from "next/server";
import type { QuizEvent } from "@/lib/data";
import { requireOwnerSession, requireAdminSession } from "@/lib/admin-permissions";
import { listGrantedEventSlugs } from "@/lib/moderator-grants";
import { normalizeNewEvent } from "@/lib/event-normalize";
import { eventPath } from "@/lib/regions";
import { revalidateAfterNewEvent } from "@/lib/revalidate-public";
import { readAllEventsRaw, updateEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionOrRes = requireAdminSession(req);
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const data = await readAllEventsRaw();
  let events: QuizEvent[] = data.events;
  if (session.role === "moderator") {
    const allowed = new Set(await listGrantedEventSlugs(session.username));
    events = events.filter((event) => allowed.has(event.slug));
  }

  return NextResponse.json(
    { ...data, events },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const ownerOrRes = requireOwnerSession(req);
  if (ownerOrRes instanceof NextResponse) return ownerOrRes;

  const body = await req.json();
  const newEvent = normalizeNewEvent(body);

  if (!newEvent.venue) {
    return NextResponse.json({ error: "Vyplň názov podniku (venue)." }, { status: 400 });
  }
  if (!newEvent.slug) {
    return NextResponse.json({ error: "Slug sa nepodarilo vygenerovať." }, { status: 400 });
  }

  const { events: existingEvents } = await readAllEventsRaw();
  const duplicate = existingEvents.find((event) => event.slug === newEvent.slug);
  if (duplicate) {
    return NextResponse.json(
      {
        error: `Udalosť so slug „${newEvent.slug}“ už existuje.`,
        slug: newEvent.slug,
        editUrl: `/admin/udalosti/${newEvent.slug}`,
        publicUrl: eventPath(duplicate),
      },
      { status: 409 }
    );
  }

  try {
    await updateEvents((events) => [...events, newEvent]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní udalosti.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  revalidateAfterNewEvent(newEvent);

  return NextResponse.json(newEvent, { status: 201 });
}
