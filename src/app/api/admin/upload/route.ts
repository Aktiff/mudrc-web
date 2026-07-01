import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { hasSupabaseStorage, supabaseUploadPublicImage } from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Nebol vybraný súbor." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Povolené sú len obrázky (JPG, PNG, WEBP)." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
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
