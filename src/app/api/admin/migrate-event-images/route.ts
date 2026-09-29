import { NextResponse } from "next/server";
import { migrateEventImagesToBlob } from "@/lib/media-migrate-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await migrateEventImagesToBlob();
  if ("error" in result && result.error) {
    return NextResponse.json(result, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
