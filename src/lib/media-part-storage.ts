import fs from "fs";
import path from "path";
import {
  blobMediaPathname,
  deleteBlobMedia,
  readBlobMediaBuffer,
  uploadBlobMedia,
} from "@/lib/blob-media";
import { shouldWriteBlob } from "@/lib/storage";
import { guessAudioContentType, isAllowedAudioFile, MAX_AUDIO_BYTES } from "@/lib/audio-upload";
import { guessVideoContentType, isAllowedVideoFile, MAX_VIDEO_BYTES } from "@/lib/video-upload";
import { MEDIA_PART_BYTES } from "@/lib/media-part-size";

const MAX_PARTS = 40;

const localRoot = path.join(process.cwd(), ".upload-parts");

export type MediaUploadKind = "audio" | "video";

export function assertUploadId(uploadId: string): string {
  const id = uploadId.trim();
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) {
    throw new Error("Neplatná nahrávka.");
  }
  return id;
}

function assertKind(kind: string): MediaUploadKind {
  if (kind === "audio" || kind === "video") return kind;
  throw new Error("Neplatný typ súboru.");
}

function assertIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PARTS) {
    throw new Error("Neplatná časť nahrávky.");
  }
  return index;
}

function partKey(kind: MediaUploadKind, uploadId: string, index: number): string {
  return blobMediaPathname(`${kind}-parts`, `${uploadId}-${index}.bin`);
}

function localPartPath(kind: MediaUploadKind, uploadId: string, index: number): string {
  return path.join(localRoot, kind, uploadId, `${index}.bin`);
}

export async function saveMediaPart(
  kindRaw: string,
  uploadIdRaw: string,
  indexRaw: number,
  data: Buffer
): Promise<void> {
  const kind = assertKind(kindRaw);
  const uploadId = assertUploadId(uploadIdRaw);
  const index = assertIndex(indexRaw);
  if (data.length === 0 || data.length > MEDIA_PART_BYTES + 64 * 1024) {
    throw new Error("Časť nahrávky má neplatnú veľkosť.");
  }

  if (shouldWriteBlob()) {
    await uploadBlobMedia(`${kind}-parts`, `${uploadId}-${index}.bin`, data, "application/octet-stream");
    return;
  }

  const filePath = localPartPath(kind, uploadId, index);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

async function readPart(kind: MediaUploadKind, uploadId: string, index: number): Promise<Buffer> {
  if (shouldWriteBlob()) {
    return readBlobMediaBuffer(partKey(kind, uploadId, index));
  }
  const filePath = localPartPath(kind, uploadId, index);
  if (!fs.existsSync(filePath)) throw new Error("Časť nahrávky sa nenašla.");
  return fs.readFileSync(filePath);
}

async function deletePart(kind: MediaUploadKind, uploadId: string, index: number): Promise<void> {
  if (shouldWriteBlob()) {
    await deleteBlobMedia(partKey(kind, uploadId, index));
    return;
  }
  const filePath = localPartPath(kind, uploadId, index);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export async function discardMediaParts(kindRaw: string, uploadIdRaw: string, partCountRaw: number): Promise<void> {
  const kind = assertKind(kindRaw);
  const uploadId = assertUploadId(uploadIdRaw);
  const partCount = assertIndex(partCountRaw - 1) + 1;
  await Promise.all(
    Array.from({ length: partCount }, (_, index) => deletePart(kind, uploadId, index).catch(() => undefined))
  );
}

export async function finishMediaUpload(input: {
  kind: string;
  uploadId: string;
  partCount: number;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<string> {
  const kind = assertKind(input.kind);
  const uploadId = assertUploadId(input.uploadId);
  const partCount = assertIndex(input.partCount - 1) + 1;
  const fileName = input.fileName.trim();
  const allowed = kind === "audio" ? isAllowedAudioFile(fileName, input.contentType) : isAllowedVideoFile(fileName, input.contentType);
  if (!fileName || !allowed) {
    throw new Error(kind === "audio" ? "Povolené sú audio súbory (MP3, M4A, WAV, OGG)." : "Povolené sú video súbory (MP4, WEBM, MOV).");
  }

  const maxBytes = kind === "audio" ? MAX_AUDIO_BYTES : MAX_VIDEO_BYTES;
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > maxBytes) {
    throw new Error(kind === "audio" ? "Maximálna veľkosť audio je 12 MB." : "Maximálna veľkosť videa je 80 MB.");
  }

  const parts: Buffer[] = [];
  for (let index = 0; index < partCount; index += 1) {
    parts.push(await readPart(kind, uploadId, index));
  }
  const combined = Buffer.concat(parts);
  if (combined.length !== input.size) {
    throw new Error("Nahrávka prišla neúplná. Skús to znova.");
  }

  const contentType =
    kind === "audio"
      ? guessAudioContentType(fileName, input.contentType)
      : guessVideoContentType(fileName, input.contentType);
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (kind === "audio" ? "mp3" : "mp4");

  let url: string;
  if (shouldWriteBlob()) {
    const stored = await uploadBlobMedia(kind, `${Date.now()}.${ext}`, combined, contentType);
    url = stored.url;
  } else {
    const uploadDir = path.join(process.cwd(), "public/uploads", kind);
    fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), combined);
    url = `/uploads/${kind}/${filename}`;
  }

  await discardMediaParts(kind, uploadId, partCount);
  return url;
}
