import { NextRequest, NextResponse } from "next/server";
import {
  addStoredVideoBankItem,
  findVideoClipConflict,
  readStoredVideoBank,
  removeStoredVideoBankItem,
  updateStoredVideoBankItem,
} from "@/lib/video-bank-storage";
import {
  formatVideoClipDuplicateMessage,
  VideoClipDuplicateError,
  type NewVideoBankItemInput,
} from "@/lib/video-bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const label = req.nextUrl.searchParams.get("label")?.trim();
    const answer = req.nextUrl.searchParams.get("answer")?.trim();
    if (label && answer) {
      const conflict = await findVideoClipConflict(label, answer);
      return NextResponse.json({ conflict });
    }

    const clips = await readStoredVideoBank();
    return NextResponse.json({ clips });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri načítaní banky videa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NewVideoBankItemInput;
    if (!body.label?.trim() || !body.answer?.trim() || !body.videoUrl?.trim()) {
      return NextResponse.json({ error: "Vyplň popis, odpoveď a video URL." }, { status: 400 });
    }
    const clip = await addStoredVideoBankItem(body);
    const clips = await readStoredVideoBank();
    return NextResponse.json({ ok: true, clip, clips });
  } catch (error) {
    if (error instanceof VideoClipDuplicateError) {
      return NextResponse.json(
        { error: formatVideoClipDuplicateMessage(error.conflict), conflict: error.conflict },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní videa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "Chýba id ukážky" }, { status: 400 });
    const clip = await updateStoredVideoBankItem(id, body as NewVideoBankItemInput);
    const clips = await readStoredVideoBank();
    return NextResponse.json({ ok: true, clip, clips });
  } catch (error) {
    if (error instanceof VideoClipDuplicateError) {
      return NextResponse.json(
        { error: formatVideoClipDuplicateMessage(error.conflict), conflict: error.conflict },
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
    const ok = await removeStoredVideoBankItem(id);
    if (!ok) return NextResponse.json({ error: "Ukážka neexistuje" }, { status: 404 });
    const clips = await readStoredVideoBank();
    return NextResponse.json({ ok: true, clips });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri mazaní ukážky";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
