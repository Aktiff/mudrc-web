import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  guessAudioContentType,
  isAllowedAudioFile,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SERVER_BYTES,
} from "@/lib/audio-upload";
import {
  guessVideoContentType,
  isAllowedVideoFile,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SERVER_BYTES,
} from "@/lib/video-upload";
import { uploadBlobMedia, uploadEventImageToBlob } from "@/lib/blob-media";
import { shouldWriteBlob } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function uploadMediaBuffer(
  folder: "audio" | "video",
  buffer: Buffer,
  fileName: string,
  contentType: string,
  fallbackExt: string
): Promise<string> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-") || `clip.${fallbackExt}`;

  if (shouldWriteBlob()) {
    const storedName = `${Date.now()}.${safeName.split(".").pop() ?? fallbackExt}`;
    const { url } = await uploadBlobMedia(folder, storedName, buffer, contentType);
    return url;
  }

  if (process.env.VERCEL) {
    throw new Error("Upload na produkcii vyžaduje Vercel Blob (BLOB_STORE_ID / token).");
  }

  const uploadDir = path.join(process.cwd(), `public/uploads/${folder}`);
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${Date.now()}.${safeName.split(".").pop() ?? fallbackExt}`;
  fs.writeFileSync(path.join(uploadDir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kind = req.nextUrl.searchParams.get("kind") ?? "image";
    if (!file) {
      return NextResponse.json({ error: "Nebol vybraný súbor." }, { status: 400 });
    }

    const isVideo =
      kind === "video" || isAllowedVideoFile(file.name, file.type || "");
    const isAudio =
      !isVideo && (kind === "audio" || isAllowedAudioFile(file.name, file.type || ""));

    if (isVideo) {
      if (!isAllowedVideoFile(file.name, file.type || "")) {
        return NextResponse.json(
          { error: "Povolené sú video súbory (MP4, WEBM, MOV)." },
          { status: 400 }
        );
      }
      if (file.size > MAX_VIDEO_BYTES) {
        return NextResponse.json({ error: "Maximálna veľkosť videa je 80 MB." }, { status: 400 });
      }
      if (process.env.VERCEL && file.size > MAX_VIDEO_SERVER_BYTES) {
        return NextResponse.json(
          {
            error: "Súbor je príliš veľký na upload cez server. Skráť video alebo nahraj menší súbor.",
          },
          { status: 413 }
        );
      }

      const contentType = guessVideoContentType(file.name, file.type || "");
      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await uploadMediaBuffer("video", buffer, file.name, contentType, "mp4");
      return NextResponse.json({ url });
    }

    if (isAudio) {
      if (!isAllowedAudioFile(file.name, file.type || "")) {
        return NextResponse.json(
          { error: "Povolené sú audio súbory (MP3, M4A, WAV, OGG)." },
          { status: 400 }
        );
      }
      if (file.size > MAX_AUDIO_BYTES) {
        return NextResponse.json({ error: "Maximálna veľkosť audio je 12 MB." }, { status: 400 });
      }
      if (process.env.VERCEL && file.size > MAX_AUDIO_SERVER_BYTES) {
        return NextResponse.json(
          {
            error: "Súbor je príliš veľký na upload cez server (max ~3,5 MB). Skráť audio ukážku.",
          },
          { status: 413 }
        );
      }

      const contentType = guessAudioContentType(file.name, file.type || "");
      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await uploadMediaBuffer("audio", buffer, file.name, contentType, "mp3");
      return NextResponse.json({ url });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Povolené sú obrázky, audio (MP3…) alebo video (MP4…)." },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Maximálna veľkosť súboru je 5 MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (shouldWriteBlob()) {
      const url = await uploadEventImageToBlob(buffer, file.type || "image/jpeg", ext);
      return NextResponse.json({ url });
    }

    if (process.env.VERCEL) {
      return NextResponse.json(
        { error: "Upload na produkcii vyžaduje Vercel Blob (BLOB_STORE_ID / token)." },
        { status: 500 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public/uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error) {
    console.error("upload error:", error);
    const message = error instanceof Error ? error.message : "Nepodarilo sa nahrať súbor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
