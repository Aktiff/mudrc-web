import { del, get, put } from "@vercel/blob";
import { blobAuthOptions, blobStoreAccess, shouldWriteBlob } from "@/lib/storage";

export const BLOB_MEDIA_PREFIX = "mudrc/media/";

export function blobMediaPathname(folder: string, fileName: string): string {
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-") || "file.bin";
  return `${BLOB_MEDIA_PREFIX}${safeFolder}/${safeName}`;
}

/** Verejná URL cez Next route (private Blob store). */
export function mediaUrlFromBlobPathname(pathname: string): string {
  if (!pathname.startsWith(BLOB_MEDIA_PREFIX)) {
    throw new Error("Invalid media pathname");
  }
  const sub = pathname.slice(BLOB_MEDIA_PREFIX.length);
  return `/api/media/${sub.split("/").map(encodeURIComponent).join("/")}`;
}

export async function uploadBlobMedia(
  folder: string,
  fileName: string,
  data: Buffer,
  contentType: string
): Promise<{ pathname: string; url: string }> {
  if (!shouldWriteBlob()) {
    throw new Error("BLOB_NOT_CONFIGURED");
  }
  const auth = blobAuthOptions();
  if (!auth.token && !auth.storeId) {
    throw new Error("BLOB_NOT_CONFIGURED");
  }

  const pathname = blobMediaPathname(folder, fileName);
  await put(pathname, data, {
    access: blobStoreAccess(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    ...auth,
  });

  return { pathname, url: mediaUrlFromBlobPathname(pathname) };
}

export async function readBlobMediaBuffer(pathname: string): Promise<Buffer> {
  if (!pathname.startsWith(BLOB_MEDIA_PREFIX)) {
    throw new Error("Invalid media pathname");
  }
  const auth = blobAuthOptions();
  const result = await get(pathname, {
    access: blobStoreAccess(),
    useCache: false,
    ...auth,
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Časť nahrávky sa nenašla.");
  }
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export async function deleteBlobMedia(pathname: string): Promise<void> {
  if (!pathname.startsWith(BLOB_MEDIA_PREFIX)) return;
  try {
    await del(pathname, blobAuthOptions());
  } catch {
    /* dočasná časť už nemusí byť */
  }
}

export async function uploadEventImageToBlob(
  data: Buffer,
  contentType: string,
  ext: string
): Promise<string> {
  const fileName = `${Date.now()}.${ext}`;
  const { url } = await uploadBlobMedia("events", fileName, data, contentType);
  return url;
}
