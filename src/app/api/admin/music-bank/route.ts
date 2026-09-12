import { NextRequest, NextResponse } from "next/server";
import {
  addStoredMusicBankItem,
  findMusicTrackConflict,
  readStoredMusicBank,
  removeStoredMusicBankItem,
} from "@/lib/music-bank-storage";
import { formatMusicTrackDuplicateMessage, MusicTrackDuplicateError, type NewMusicBankItemInput } from "@/lib/music-bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const artist = req.nextUrl.searchParams.get("artist")?.trim();
    const title = req.nextUrl.searchParams.get("title")?.trim();
    if (artist && title) {
      const conflict = await findMusicTrackConflict(artist, title);
      return NextResponse.json({ conflict });
    }

    const tracks = await readStoredMusicBank();
    return NextResponse.json({ tracks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri načítaní banky hudby";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NewMusicBankItemInput;
    if (!body.artist?.trim() || !body.title?.trim() || !body.audioUrl?.trim()) {
      return NextResponse.json({ error: "Vyplň interpreta, názov skladby a audio URL." }, { status: 400 });
    }
    const track = await addStoredMusicBankItem(body);
    const tracks = await readStoredMusicBank();
    return NextResponse.json({ ok: true, track, tracks });
  } catch (error) {
    if (error instanceof MusicTrackDuplicateError) {
      return NextResponse.json(
        { error: formatMusicTrackDuplicateMessage(error.conflict), conflict: error.conflict },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní skladby";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Chýba id skladby" }, { status: 400 });
  try {
    const ok = await removeStoredMusicBankItem(id);
    if (!ok) return NextResponse.json({ error: "Skladba neexistuje" }, { status: 404 });
    const tracks = await readStoredMusicBank();
    return NextResponse.json({ ok: true, tracks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri mazaní skladby";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
