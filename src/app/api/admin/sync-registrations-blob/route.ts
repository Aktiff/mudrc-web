import { NextResponse } from "next/server";
import { persistRegistrations, readRegistrations, shouldWriteBlob } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!shouldWriteBlob()) {
    return NextResponse.json({ ok: false, error: "Blob nie je nakonfigurovaný." }, { status: 503 });
  }

  try {
    const { registrations } = await readRegistrations();
    await persistRegistrations(registrations);
    return NextResponse.json(
      { ok: true, registrationCount: registrations.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
