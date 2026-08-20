import { NextRequest, NextResponse } from "next/server";
import { deleteLibraryQuiz, readLibraryQuiz, saveLibraryQuiz } from "@/lib/quiz-library-storage";
import { getQuizUsages } from "@/lib/quiz-library-usage";
import { collectPlayedTeamNames } from "@/lib/quiz-library";
import { readAllEventsRaw, readAllStoredQuizzes } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const [quiz, storedQuizzes, { events }] = await Promise.all([
      readLibraryQuiz(params.id),
      readAllStoredQuizzes(),
      readAllEventsRaw(),
    ]);
    if (!quiz) return NextResponse.json({ error: "Kvíz nenájdený" }, { status: 404 });

    const usages = getQuizUsages(params.id, storedQuizzes, events);
    return NextResponse.json({
      ...quiz,
      usages,
      playedTeamNames: collectPlayedTeamNames(usages),
      usageCount: usages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa načítať kvíz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const body = await req.json();
    const saved = await saveLibraryQuiz({ ...body, id: params.id });
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa uložiť kvíz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const removed = await deleteLibraryQuiz(params.id);
    if (!removed) return NextResponse.json({ error: "Kvíz nenájdený" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa zmazať kvíz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
