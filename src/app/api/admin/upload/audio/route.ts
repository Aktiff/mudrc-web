import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import { MAX_AUDIO_BYTES } from "@/lib/audio-upload";
import { hasBlobStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "application/octet-stream",
];

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 });
  }

  if (!hasBlobStorage()) {
    return NextResponse.json(
      {
        error:
          "Priame nahrávanie veľkých súborov vyžaduje Vercel Blob (BLOB_READ_WRITE_TOKEN). Skús menší súbor (~30 s) alebo vlož URL.",
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: AUDIO_CONTENT_TYPES,
        maximumSizeInBytes: MAX_AUDIO_BYTES,
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("audio client upload error:", error);
    const message = error instanceof Error ? error.message : "Nepodarilo sa nahrať audio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
