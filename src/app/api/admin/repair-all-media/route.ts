import { NextResponse } from "next/server";
import { runFullMediaRepair } from "@/lib/repair-all-media-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Opraví fotky podnikov + ukážky vo všetkých hotových kvízochn a bankách. */
export async function POST() {
  const result = await runFullMediaRepair();
  const status = "error" in result && result.error ? 503 : 200;
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
