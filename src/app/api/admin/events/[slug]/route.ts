import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { QuizEvent, LeagueEntry } from "@/lib/data";
import { readEvents, writeEvents } from "@/lib/storage";

function rebuildLeagueTable(event: QuizEvent): LeagueEntry[] {
  const table: LeagueEntry[] = [];
  for (const result of event.pastResults ?? []) {
    if (!result.teams?.length) continue;
    for (const team of result.teams) {
      const existing = table.find((r) => r.teamName === team.teamName);
      if (existing) {
        existing.points += team.ligaPoints;
        existing.quizzesPlayed += 1;
      } else {
        table.push({
          rank: 0,
          teamName: team.teamName,
          points: team.ligaPoints,
          quizzesPlayed: 1,
        });
      }
    }
  }
  table.sort((a, b) => b.points - a.points || b.quizzesPlayed - a.quizzesPlayed);
  table.forEach((r, i) => {
    r.rank = i + 1;
  });
  return table;
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { active }: { active: boolean } = await req.json();
    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "Chybny parameter" }, { status: 400 });
    }

    const data = await readEvents();
    const idx = data.events.findIndex((e) => e.slug === params.slug);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const event = data.events[idx];
    let leagueTable = [...(event.leagueTable ?? [])];
    const pastResults = event.pastResults ?? [];

    if (active && leagueTable.length === 0 && pastResults.length > 0) {
      leagueTable = rebuildLeagueTable(event);
    }

    if (active && leagueTable.length === 0 && pastResults.length === 0) {
      return NextResponse.json(
        { error: "Liga nema ziadne data. Najprv uloz kviz alebo pridaj timy." },
        { status: 400 }
      );
    }

    data.events[idx] = { ...event, leagueTable, leagueActive: active };
    await writeEvents(data);
    revalidatePath("/liga");
    revalidatePath(`/liga/${params.slug}`);
    return NextResponse.json(data.events[idx]);
  } catch {
    return NextResponse.json({ error: "Chyba pri ukladani" }, { status: 500 });
  }
}

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
    revalidatePath("/liga");
    revalidatePath(`/liga/${params.slug}`);
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