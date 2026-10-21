import { NextRequest, NextResponse } from "next/server";
import { revalidatePublicEventPaths } from "@/lib/revalidate-public";
import { futureQuizDateError, futureQuizMatchesDate, normalizeFutureQuizzes } from "@/lib/future-quizzes";
import { normalizeDateKey } from "@/lib/quiz-result-key";
import { quizTypeOrDefault } from "@/lib/quiz-type";
import { patchEvent, readEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const body = (await req.json().catch(() => null)) as { date?: unknown; time?: unknown; quizType?: unknown } | null;
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  const time = typeof body?.time === "string" && body.time.trim() ? body.time.trim() : "";
  const quizType = quizTypeOrDefault(typeof body?.quizType === "string" ? body.quizType : "");

  const { events } = await readEvents();
  const event = events.find((entry) => entry.slug === params.slug);
  if (!event) return NextResponse.json({ error: "Podnik sa nenašiel." }, { status: 404 });

  const existing = normalizeFutureQuizzes(event.futureQuizzes);
  const error = futureQuizDateError(event.date, date, existing);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const next = normalizeFutureQuizzes([
    ...existing,
    { id: normalizeDateKey(date), date, time: time || event.time || "19:00", quizType },
  ]);
  const updated = await patchEvent(params.slug, { futureQuizzes: next });
  await revalidatePublicEventPaths(params.slug);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; date?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  if (!id && !date) return NextResponse.json({ error: "Chýba termín." }, { status: 400 });

  const { events } = await readEvents();
  const event = events.find((entry) => entry.slug === params.slug);
  if (!event) return NextResponse.json({ error: "Podnik sa nenašiel." }, { status: 404 });

  const existing = normalizeFutureQuizzes(event.futureQuizzes);
  const next = existing.filter((quiz) => {
    if (id && quiz.id === id) return false;
    if (date && futureQuizMatchesDate(quiz, date)) return false;
    return true;
  });
  if (next.length === existing.length) {
    return NextResponse.json({ error: "Termín sa nenašiel." }, { status: 404 });
  }
  const updated = await patchEvent(params.slug, { futureQuizzes: next });
  await revalidatePublicEventPaths(params.slug);
  return NextResponse.json(updated);
}
