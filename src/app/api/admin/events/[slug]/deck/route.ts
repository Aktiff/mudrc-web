import { NextRequest, NextResponse } from "next/server";
import { readQuizDeck, saveQuizDeck } from "@/lib/quiz-deck-storage";
import type { QuizDeck } from "@/lib/quiz-deck";
import { readEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getVenueTitle(slug: string): Promise<string> {
  const { events } = await readEvents();
  return events.find((event) => event.slug === slug)?.venue ?? slug;
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const venueTitle = await getVenueTitle(params.slug);
    const deck = await readQuizDeck(params.slug, venueTitle);
    return NextResponse.json(deck, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa načítať prezentáciu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = (await req.json()) as Partial<QuizDeck>;
    const venueTitle = await getVenueTitle(params.slug);
    const saved = await saveQuizDeck({
      ...body,
      eventSlug: params.slug,
      venueTitle: body.venueTitle ?? venueTitle,
      slides: body.slides ?? [],
      updatedAt: body.updatedAt ?? new Date().toISOString(),
    });
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa uložiť prezentáciu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
