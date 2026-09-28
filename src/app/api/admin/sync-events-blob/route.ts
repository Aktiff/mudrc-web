import { NextResponse } from "next/server";
import { readAllEventsRaw, persistEvents, shouldWriteBlob } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jednorazovo rozdelí monolit mudrc/events.json na mudrc/events/{slug}.json + manifest. */
export async function POST() {
  if (!shouldWriteBlob()) {
    return NextResponse.json({ ok: false, error: "Blob nie je nakonfigurovaný." }, { status: 503 });
  }

  try {
    const { events } = await readAllEventsRaw();
    if (!events.length) {
      return NextResponse.json({ ok: false, error: "Žiadne udalosti na synchronizáciu." }, { status: 400 });
    }
    await persistEvents(events);
    return NextResponse.json(
      { ok: true, eventCount: events.length, slugs: events.map((e) => e.slug) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
