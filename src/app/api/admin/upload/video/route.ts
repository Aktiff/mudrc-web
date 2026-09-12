import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import {
  formatSupabaseVideoUploadError,
  guessVideoContentType,
  isAllowedVideoFile,
  MAX_VIDEO_BYTES,
} from "@/lib/video-upload";
import { hasSupabaseStorage, supabaseCreateSignedVideoUpload } from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignedUploadBody = {
  fileName?: string;
  contentType?: string;
  fileSize?: number;
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 });
  }

  if (!hasSupabaseStorage()) {
    return NextResponse.json(
      {
        error:
          "Chýba Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Video sa ukladá do bucketu uploads.",
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
  if (!isAllowedVideoFile(fileName, contentType)) {
    return NextResponse.json({ error: "Povolené sú video súbory (MP4, WEBM, MOV)." }, { status: 400 });
  }
  if (fileSize <= 0 || fileSize > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "Maximálna veľkosť videa je 80 MB." }, { status: 400 });
  }

  try {
    const signed = await supabaseCreateSignedVideoUpload(fileName);
    return NextResponse.json({
      ...signed,
      contentType: guessVideoContentType(fileName, contentType),
    });
  } catch (error) {
    console.error("signed video upload prep error:", error);
    const message = error instanceof Error ? error.message : "Nepodarilo sa pripraviť upload.";
    return NextResponse.json({ error: formatSupabaseVideoUploadError(message) }, { status: 500 });
  }
}
