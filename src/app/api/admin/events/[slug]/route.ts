import { NextRequest, NextResponse } from "next/server";
import { readEvents, writeEvents } from "@/lib/storage";

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const resetLeague = body._resetLeague === true;
    const { _resetLeague: _, ...incoming } = body;

    const data = await readEvents();
    const idx = data.events.findIndex((e) => e.slug === params.slug);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = data.events[idx];
    const merged = { ...existing, ...incoming, slug: params.slug };

    if (
      !resetLeague &&
      existing.leagueTable.length > 0 &&
      Array.isArray(incoming.leagueTable) &&
      incoming.leagueTable.length === 0
    ) {
      merged.leagueTable = existing.leagueTable;
    }
    if (
      !resetLeague &&
      existing.pastResults.length > 0 &&
      Array.isArray(incoming.pastResults) &&
      incoming.pastResults.length === 0
    ) {
      merged.pastResults = existing.pastResults;
    }
    if (
      !resetLeague &&
      incoming.leagueActive === false &&
      Array.isArray(incoming.leagueTable) &&
      incoming.leagueTable.length === 0 &&
      (merged.leagueTable.length > 0 || merged.pastResults.length > 0)
    ) {
      merged.leagueActive = true;
    }
    if ((merged.leagueTable.length > 0 || merged.pastResults.length > 0) && merged.leagueActive !== false) {
      merged.leagueActive = true;
    }

    data.events[idx] = merged;
    await writeEvents(data);
    return NextResponse.json(data.events[idx]);
  } catch {
    return NextResponse.json({ error: "Chyba pri ukladani" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const data = await readEvents();
    data.events = data.events.filter((e) => e.slug !== params.slug);
    await writeEvents(data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Chyba pri mazani" }, { status: 500 });
  }
}