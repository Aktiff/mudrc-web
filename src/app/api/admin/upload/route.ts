import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { hasSupabaseStorage, supabaseUploadPublicFile, supabaseUploadPublicImage } from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kind = req.nextUrl.searchParams.get("kind") ?? "image";
    if (!file) {
      return NextResponse.json({ error: "Nebol vybraný súbor." }, { status: 400 });
    }

    const isAudio = kind === "audio" || AUDIO_TYPES.has(file.type) || /\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name);
    if (isAudio) {
      if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name)) {
        return NextResponse.json({ error: "Povolené sú audio súbory (MP3, M4A, WAV, OGG)." }, { status: 400 });
      }
      if (file.size > MAX_AUDIO_BYTES) {
        return NextResponse.json({ error: "Maximálna veľkosť audio je 12 MB." }, { status: 400 });
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
      const buffer = Buffer.from(await file.arrayBuffer());
      const contentType = file.type || "audio/mpeg";

      if (hasSupabaseStorage()) {
        const url = await supabaseUploadPublicFile("audio", `${Date.now()}.${ext}`, buffer, contentType);
        return NextResponse.json({ url });
      }
      if (process.env.VERCEL) {
        return NextResponse.json(
          { error: "Upload audio na produkcii vyžaduje Supabase (bucket uploads)." },
          { status: 500 }
        );
      }
      const uploadDir = path.join(process.cwd(), "public/uploads/audio");
      fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      return NextResponse.json({ url: `/uploads/audio/${filename}` });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Povolené sú len obrázky (JPG, PNG, WEBP) alebo audio (MP3…)." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Maximálna veľkosť súboru je 5 MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (hasSupabaseStorage()) {
      const url = await supabaseUploadPublicImage(`${Date.now()}.${ext}`, buffer, file.type || "image/jpeg");
      return NextResponse.json({ url });
    }

    if (process.env.VERCEL) {
      return NextResponse.json(
        {
          error:
            "Upload na produkcii vyžaduje Supabase. V SQL Editore spusti scripts/supabase.sql (bucket uploads) a skontroluj SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.",
        },
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
    const message = error instanceof Error ? error.message : "Nepodarilo sa nahrať fotku.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
