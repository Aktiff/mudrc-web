import { MEDIA_PART_BYTES } from "@/lib/media-part-size";

type MediaUploadKind = "audio" | "video";

function messageFromUploadResponse(res: Response, text: string): string {
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) return data.error;
  } catch {
    /* not JSON */
  }
  if (res.status === 413) return "Súbor je príliš veľký na jednu časť uploadu.";
  if (text.trim()) return text.slice(0, 280);
  return `Nepodarilo sa nahrať súbor (HTTP ${res.status}).`;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(messageFromUploadResponse(res, text));
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Neplatná odpoveď servera pri nahrávaní.");
  }
}

/** Väčší súbor ide po častiach na server. Server ho uloží do Blobu tým istým prístupom ako ostatné dáta. */
export async function uploadFileInParts(kind: MediaUploadKind, file: File): Promise<string> {
  const uploadId = crypto.randomUUID();
  const partCount = Math.ceil(file.size / MEDIA_PART_BYTES);

  try {
    for (let index = 0; index < partCount; index += 1) {
      const slice = file.slice(index * MEDIA_PART_BYTES, Math.min(file.size, (index + 1) * MEDIA_PART_BYTES));
      const formData = new FormData();
      formData.append("file", slice, "part.bin");
      formData.append("uploadId", uploadId);
      formData.append("index", String(index));
      formData.append("kind", kind);
      const res = await fetch("/api/admin/upload/parts", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      await readJson(res);
    }

    const res = await fetch("/api/admin/upload/parts", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        complete: true,
        uploadId,
        partCount,
        fileName: file.name,
        kind,
        contentType: file.type,
        size: file.size,
      }),
    });
    const data = await readJson<{ url?: string }>(res);
    if (!data.url) throw new Error("Server nevrátil URL súboru.");
    return data.url;
  } catch (error) {
    void fetch("/api/admin/upload/parts", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ abort: true, uploadId, partCount, kind }),
    }).catch(() => undefined);
    throw error instanceof Error ? error : new Error("Nepodarilo sa nahrať súbor.");
  }
}
