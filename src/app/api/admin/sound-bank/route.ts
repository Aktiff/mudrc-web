import { NextRequest, NextResponse } from "next/server";
import {
  addStoredSoundBankItem,
  findSoundClipConflict,
  readStoredSoundBank,
  removeStoredSoundBankItem,
  updateStoredSoundBankItem,
} from "@/lib/sound-bank-storage";
import {
  formatSoundClipDuplicateMessage,
  SoundClipDuplicateError,
  type NewSoundBankItemInput,
} from "@/lib/sound-bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const label = req.nextUrl.searchParams.get("label")?.trim();
    const answer = req.nextUrl.searchParams.get("answer")?.trim();
    if (label && answer) {
      const conflict = await findSoundClipConflict(label, answer);
      return NextResponse.json({ conflict });
    }

    const clips = await readStoredSoundBank();
    return NextResponse.json({ clips });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri načítaní banky zvuku";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NewSoundBankItemInput;
    if (!body.label?.trim() || !body.answer?.trim() || !body.audioUrl?.trim()) {
      return NextResponse.json({ error: "Vyplň popis, odpoveď a audio URL." }, { status: 400 });
    }
    const clip = await addStoredSoundBankItem(body);
    const clips = await readStoredSoundBank();
    return NextResponse.json({ ok: true, clip, clips });
  } catch (error) {
    if (error instanceof SoundClipDuplicateError) {
      return NextResponse.json(
        { error: formatSoundClipDuplicateMessage(error.conflict), conflict: error.conflict },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní zvuku";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "Chýba id ukážky" }, { status: 400 });
    const clip = await updateStoredSoundBankItem(id, body as NewSoundBankItemInput);
    const clips = await readStoredSoundBank();
    return NextResponse.json({ ok: true, clip, clips });
  } catch (error) {
    if (error instanceof SoundClipDuplicateError) {
      return NextResponse.json(
        { error: formatSoundClipDuplicateMessage(error.conflict), conflict: error.conflict },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Chyba pri úprave ukážky";
    const status = message === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Chýba id ukážky" }, { status: 400 });
  try {
    const ok = await removeStoredSoundBankItem(id);
    if (!ok) return NextResponse.json({ error: "Ukážka neexistuje" }, { status: 404 });
    const clips = await readStoredSoundBank();
    return NextResponse.json({ ok: true, clips });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri mazaní ukážky";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
