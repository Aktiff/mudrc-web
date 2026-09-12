import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import {
  formatSupabaseAudioUploadError,
  guessAudioContentType,
  isAllowedAudioFile,
  MAX_AUDIO_BYTES,
} from "@/lib/audio-upload";
import { hasSupabaseStorage, supabaseCreateSignedAudioUpload } from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignedUploadBody = {
  fileName?: string;
  contentType?: string;
  fileSize?: number;
};

/** Pripraví priamy upload do Supabase Storage (obíde limit tela requestu na Verceli). */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 });
  }

  if (!hasSupabaseStorage()) {
    return NextResponse.json(
      {
        error:
          "Chýba Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Audio sa ukladá do bucketu uploads — rovnako ako fotky podnikov.",
      },
      { status: 503 }
    );
  }

  let body: SignedUploadBody;
  try {
    body = (await request.json()) as SignedUploadBody;
  } catch {
    return NextResponse.json({ error: "Neplatné telo požiadavky." }, { status: 400 });
  }

  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
  const contentType = typeof body.contentType === "string" ? body.contentType : "";

  if (!fileName.trim()) {
    return NextResponse.json({ error: "Chýba názov súboru." }, { status: 400 });
  }
  if (!isAllowedAudioFile(fileName, contentType)) {
    return NextResponse.json({ error: "Povolené sú audio súbory (MP3, M4A, WAV, OGG)." }, { status: 400 });
  }
  if (fileSize <= 0 || fileSize > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Maximálna veľkosť audio je 12 MB — skráť ukážku na ~30 s." },
      { status: 400 }
    );
  }

  try {
    const signed = await supabaseCreateSignedAudioUpload(fileName);
    return NextResponse.json({
      ...signed,
      contentType: guessAudioContentType(fileName, contentType),
    });
  } catch (error) {
    console.error("signed audio upload prep error:", error);
    const message = error instanceof Error ? error.message : "Nepodarilo sa pripraviť upload.";
    return NextResponse.json(
      { error: formatSupabaseAudioUploadError(message) },
      { status: 500 }
    );
  }
}
