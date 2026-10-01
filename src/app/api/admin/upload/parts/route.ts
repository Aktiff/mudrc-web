import { NextRequest, NextResponse } from "next/server";
import { discardMediaParts, finishMediaUpload, saveMediaPart } from "@/lib/media-part-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Nepodarilo sa nahrať súbor.";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as {
        abort?: boolean;
        complete?: boolean;
        uploadId?: string;
        partCount?: number;
        fileName?: string;
        kind?: string;
        contentType?: string;
        size?: number;
      };
      const uploadId = typeof body.uploadId === "string" ? body.uploadId : "";
      const partCount = Number(body.partCount);
      const kind = typeof body.kind === "string" ? body.kind : "";

      if (body.abort === true) {
        await discardMediaParts(kind, uploadId, partCount);
        return NextResponse.json({ ok: true });
      }

      const url = await finishMediaUpload({
        kind,
        uploadId,
        partCount,
        fileName: typeof body.fileName === "string" ? body.fileName : "",
        contentType: typeof body.contentType === "string" ? body.contentType : "",
        size: Number(body.size),
      });
      return NextResponse.json({ url });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const uploadId = String(formData.get("uploadId") ?? "");
    const index = Number(formData.get("index"));
    const kind = String(formData.get("kind") ?? "");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Chýba časť súboru." }, { status: 400 });
    }
    const data = Buffer.from(await file.arrayBuffer());
    await saveMediaPart(kind, uploadId, index, data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
