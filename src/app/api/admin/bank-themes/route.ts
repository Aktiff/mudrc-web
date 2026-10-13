import { NextRequest, NextResponse } from "next/server";
import { addStoredBankTheme, readStoredBankThemes } from "@/lib/bank-themes-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const themes = await readStoredBankThemes();
    return NextResponse.json(
      { themes },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Témy sa nepodarilo načítať";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string };
    const themes = await addStoredBankTheme(typeof body?.name === "string" ? body.name : "");
    return NextResponse.json({ ok: true, themes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tému sa nepodarilo pridať";
    const status = message === "Zadaj názov témy" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
