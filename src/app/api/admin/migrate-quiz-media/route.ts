import { NextResponse } from "next/server";
import { migrateQuizMediaToBlob } from "@/lib/media-migrate-quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await migrateQuizMediaToBlob();
  if ("error" in result && result.error) {
    return NextResponse.json(result, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
