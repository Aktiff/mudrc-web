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

function applyLeagueDataMerge(existing: QuizEvent, incoming: Partial<QuizEvent>): Pick<QuizEvent, "leagueTable" | "pastResults" | "leagueActive"> {
  const existingPR = existing.pastResults ?? [];
  const existingLT = existing.leagueTable ?? [];
  const incomingPR = Array.isArray(incoming.pastResults) ? incoming.pastResults : existingPR;
  const incomingLT = Array.isArray(incoming.leagueTable) ? incoming.leagueTable : existingLT;

  let pastResults = existingPR;
  if (incomingPR.length >= existingPR.length) {
    pastResults = incomingPR;
  }

  let leagueTable = existingLT;
  if (existingPR.length > 0 && incomingLT.length < existingLT.length) {
    leagueTable = existingLT.length > 0 ? existingLT : rebuildLeagueTable({ ...existing, pastResults });
  } else if (incomingLT.length >= existingLT.length || existingPR.length === 0) {
    leagueTable = incomingLT;
  }

  let leagueActive = existing.leagueActive;
  if (typeof incoming.leagueActive === "boolean") {
    leagueActive = incoming.leagueActive;
  } else if ((leagueTable.length > 0 || pastResults.length > 0) && leagueActive !== false) {
    leagueActive = true;
  }

  return { leagueTable, pastResults, leagueActive };
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const leagueActive: boolean =
      typeof body.leagueActive === "boolean"
        ? body.leagueActive
        : typeof body.active === "boolean"
        ? body.active
        : (null as unknown as boolean);

    if (typeof leagueActive !== "boolean") {
      return NextResponse.json({ error: "Chybny parameter leagueActive" }, { status: 400 });
    }

    const data = await readEvents();
    const idx = data.events.findIndex((e) => e.slug === params.slug);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const event = data.events[idx];
    let leagueTable = [...(event.leagueTable ?? [])];
    const pastResults = event.pastResults ?? [];

    if (leagueActive && leagueTable.length === 0 && pastResults.length > 0) {
      leagueTable = rebuildLeagueTable(event);
    }

    if (leagueActive && leagueTable.length === 0 && pastResults.length === 0) {
      return NextResponse.json(
        { error: "Liga nema ziadne data. Najprv uloz kviz cez prezentaciu alebo pridaj vysledky." },
        { status: 400 }
      );
    }

    data.events[idx] = { ...event, leagueTable, leagueActive };
    await writeEvents(data);
    revalidatePath("/liga");
    revalidatePath(`/liga/${params.slug}`);
    return NextResponse.json(data.events[idx]);
  } catch (e) {
    console.error("PATCH league error:", e);
    return NextResponse.json({ error: "Chyba pri ukladani ligy" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const resetLeague = body._resetLeague === true;
    const leagueToggle = body._leagueToggle === true;
    const quizToggle = body._quizToggle === true;
    const includeLeagueData = body._includeLeagueData === true;
    const { _resetLeague: _, _leagueToggle: __, _quizToggle: ___, _includeLeagueData: ____, ...incoming } = body;

    const data = await readEvents();
    const idx = data.events.findIndex((e) => e.slug === params.slug);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = data.events[idx];

    if (resetLeague) {
      const updated = {
        ...existing,
        ...incoming,
        slug: params.slug,
        leagueTable: [],
        pastResults: [],
        leagueActive: false,
      };
      data.events[idx] = updated;
      await writeEvents(data);
      revalidatePath("/liga");
      revalidatePath(`/liga/${params.slug}`);
      return NextResponse.json(updated);
    }

    if (leagueToggle && typeof incoming.leagueActive === "boolean") {
      let leagueTable = [...(existing.leagueTable ?? [])];
      const pastResults = existing.pastResults ?? [];

      if (incoming.leagueActive && leagueTable.length === 0 && pastResults.length > 0) {
        leagueTable = rebuildLeagueTable(existing);
      }

      if (incoming.leagueActive && leagueTable.length === 0 && pastResults.length === 0) {
        return NextResponse.json(
          { error: "Liga nema ziadne data. Najprv uloz kviz cez prezentaciu." },
          { status: 400 }
        );
      }

      const updated = { ...existing, leagueTable, leagueActive: incoming.leagueActive };
      data.events[idx] = updated;
      await writeEvents(data);
      revalidatePath("/liga");
      revalidatePath(`/liga/${params.slug}`);
      return NextResponse.json(updated);
    }

    if (quizToggle && typeof incoming.active === "boolean") {
      const updated = { ...existing, active: incoming.active };
      data.events[idx] = updated;
      await writeEvents(data);
      return NextResponse.json(updated);
    }

    const { leagueTable: _lt, pastResults: _pr, leagueActive: _la, ...safeIncoming } = incoming;
    let merged: QuizEvent = { ...existing, ...safeIncoming, slug: params.slug };

    if (includeLeagueData) {
      merged = { ...merged, ...applyLeagueDataMerge(existing, incoming) };
    } else {
      merged.leagueTable = existing.leagueTable ?? [];
      merged.pastResults = existing.pastResults ?? [];
      merged.leagueActive = existing.leagueActive;
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