import { NextRequest, NextResponse } from "next/server";
import { deleteLibraryQuiz, readLibraryQuiz, saveLibraryQuiz } from "@/lib/quiz-library-storage";
import { getQuizUsages } from "@/lib/quiz-library-usage";
import { collectPlayedTeamNames, collectUsedBankQuestionIdsFromQuiz, normalizeLibraryQuiz } from "@/lib/quiz-library";
import { hydrateQuizMediaForPlayback } from "@/lib/quiz-media-resolve";
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
    const normalized = normalizeLibraryQuiz(quiz);
    const hydrated = await hydrateQuizMediaForPlayback(normalized);
    return NextResponse.json({
      ...hydrated,
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
    const raw = error instanceof Error ? error.message : "Nepodarilo sa uložiť kvíz.";
    const message = raw.toLowerCase().includes("supabase")
      ? "Uloženie do Supabase zlyhalo — skús znova o minútu (ukladá sa do Blob). Ak chyba ostáva, obnov stránku Ctrl+F5."
      : raw;
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
