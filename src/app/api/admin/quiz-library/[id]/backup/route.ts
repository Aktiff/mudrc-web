import { NextRequest, NextResponse } from "next/server";
import { readQuizLibraryBackup, restoreLibraryQuizFromBackup } from "@/lib/quiz-library-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const backup = await readQuizLibraryBackup(params.id);
    if (!backup) {
      return NextResponse.json({ backup: null });
    }
    const filled = backup.questions.filter(
      (q) => q.body.trim() || q.answer.trim() || q.audioUrl?.trim() || q.videoUrl?.trim()
    ).length;
    return NextResponse.json({ backup, filledCount: filled, questionCount: backup.questions.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Záloha sa nepodarila načítať.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const restored = await restoreLibraryQuizFromBackup(params.id);
    if (!restored) {
      return NextResponse.json({ error: "Záloha pre tento kvíz neexistuje (vzniká až po ďalšom uložení)." }, { status: 404 });
    }
    return NextResponse.json(restored);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Obnova zlyhala.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
