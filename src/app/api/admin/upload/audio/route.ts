import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starý priamy upload. Väčšie súbory idú cez /api/admin/upload/blob-client. */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Tento upload už nie je podporovaný. Použi tlačidlo Nahrať v editore." },
    { status: 410 }
  );
}
