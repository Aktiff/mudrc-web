import { NextRequest, NextResponse } from "next/server";
import { deleteLibraryQuiz, readLibraryQuiz, saveLibraryQuiz } from "@/lib/quiz-library-storage";
import { collectUsedBankQuestionIdsFromQuiz, normalizeLibraryQuiz } from "@/lib/quiz-library";
import { hydrateQuizMediaForPlayback } from "@/lib/quiz-media-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const quiz = await readLibraryQuiz(params.id);
    if (!quiz) return NextResponse.json({ error: "Kvíz nenájdený" }, { status: 404 });

    const normalized = normalizeLibraryQuiz(quiz);
    const hydrated = await hydrateQuizMediaForPlayback(normalized);
    return NextResponse.json(hydrated);
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
    const existing = await readLibraryQuiz(params.id);
    if (!existing) return NextResponse.json({ error: "Kvíz nenájdený" }, { status: 404 });

    const releasedBankQuestionIds = collectUsedBankQuestionIdsFromQuiz(existing);
    const removed = await deleteLibraryQuiz(params.id);
    if (!removed) return NextResponse.json({ error: "Kvíz nenájdený" }, { status: 404 });
    return NextResponse.json({ ok: true, releasedBankQuestionIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa zmazať kvíz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
