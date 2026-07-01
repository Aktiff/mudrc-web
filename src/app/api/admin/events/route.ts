import { NextRequest, NextResponse } from "next/server";
import type { QuizEvent } from "@/lib/data";
import { readEvents, updateEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET() {
  const data = await readEvents();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const newEvent: QuizEvent = {
    ...body,
    slug: body.slug || slugify(body.venue),
    leagueTable: body.leagueTable ?? [],
    pastResults: body.pastResults ?? [],
  };

  try {
    await updateEvents((events) => {
      if (events.find((e) => e.slug === newEvent.slug)) throw new Error("DUPLICATE");
      return [...events, newEvent];
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE") {
      return NextResponse.json({ error: "Udalost s tymto slug uz existuje" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json(newEvent, { status: 201 });
}