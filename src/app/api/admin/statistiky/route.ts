import { NextRequest, NextResponse } from "next/server";
import { deleteQuizStatistic, listQuizStatistics, updateQuizStatistic } from "@/lib/quiz-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await listQuizStatistics();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    await updateQuizStatistic({
      slug: String(body.slug ?? ""),
      quizKey: String(body.quizKey ?? ""),
      date: String(body.date ?? ""),
      targetSlug: String(body.targetSlug ?? body.slug ?? ""),
      playerCount: Number(body.playerCount) || 0,
      teams: Array.isArray(body.teams) ? body.teams : undefined,
    });
    const data = await listQuizStatistics();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní";
    const status = message === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: message === "NOT_FOUND" ? "Kvíz sa nenašiel" : message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    await deleteQuizStatistic(String(body.slug ?? ""), String(body.quizKey ?? ""));
    const data = await listQuizStatistics();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri mazaní";
    const status = message === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message === "NOT_FOUND" ? "Kvíz sa nenašiel" : message }, { status });
  }
}
