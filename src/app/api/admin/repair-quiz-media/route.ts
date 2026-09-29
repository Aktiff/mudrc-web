import { NextRequest, NextResponse } from "next/server";
import { runRepairQuizMedia } from "@/lib/repair-quiz-media-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { quizId?: string; copyToBlob?: boolean; probeOnly?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const result = await runRepairQuizMedia(body);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
