import { NextRequest, NextResponse } from "next/server";
import type { QuizEvent } from "@/lib/data";
import { readEvents, writeEvents } from "@/lib/storage";

function slugify(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET() {
  return NextResponse.json(await readEvents());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = await readEvents();
  const newEvent: QuizEvent = { ...body, slug: body.slug || slugify(body.venue), leagueTable: body.leagueTable ?? [], pastResults: body.pastResults ?? [] };
  if (data.events.find((e) => e.slug === newEvent.slug)) {
    return NextResponse.json({ error: "Udalost s tymto slug uz existuje" }, { status: 409 });
  }
  data.events.push(newEvent);
  await writeEvents(data);
  return NextResponse.json(newEvent, { status: 201 });
}