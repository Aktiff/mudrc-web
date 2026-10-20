import crypto from "crypto";
import { NextResponse } from "next/server";
import { MAX_AUDIO_BYTES } from "@/lib/audio-upload";
import { MAX_VIDEO_BYTES } from "@/lib/video-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_HOST = "https://media.mudrc.sk";

export async function POST(req: Request) {
  const secret = process.env.MEDIA_UPLOAD_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Na Verceli chýba MEDIA_UPLOAD_SECRET. Bez neho sa ukážka na hosting neuloží." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as { kind?: unknown } | null;
  const kind = body?.kind === "video" ? "video" : body?.kind === "audio" ? "audio" : "";
  if (!kind) {
    return NextResponse.json({ error: "Neplatný typ súboru." }, { status: 400 });
  }

  const exp = Math.floor(Date.now() / 1000) + 10 * 60;
  const max = kind === "audio" ? MAX_AUDIO_BYTES : MAX_VIDEO_BYTES;
  const payload = Buffer.from(JSON.stringify({ exp, kind, max })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return NextResponse.json({
    uploadUrl: `${MEDIA_HOST}/upload.php`,
    token: `${payload}.${sig}`,
  });
}
