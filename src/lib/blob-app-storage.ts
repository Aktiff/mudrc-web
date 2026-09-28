import { del, list } from "@vercel/blob";
import { optionalReadBlob, shouldWriteBlob, writeBlob, hasBlobStorage } from "@/lib/storage";

const PREFIX = "mudrc/app-storage/";

function blobKey(name: string): string {
  return `${PREFIX}${name}.json`;
}

export async function readAppStorageBlob<T>(name: string): Promise<T | null> {
  return optionalReadBlob<T>(blobKey(name));
}

export async function writeAppStorageBlob(name: string, data: unknown): Promise<void> {
  if (!shouldWriteBlob()) {
    throw new Error("BLOB_NOT_CONFIGURED");
  }
  await writeBlob(blobKey(name), data);
}

export async function deleteAppStorageBlob(name: string): Promise<void> {
  if (!shouldWriteBlob()) return;
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  const auth = token ? { token } : {};
  try {
    await del(blobKey(name), auth);
  } catch {
    // ignore missing blob
  }
}

export async function countAppStorageBlobKeys(): Promise<number> {
  if (!hasBlobStorage()) return 0;
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  const auth = token ? { token } : {};
  try {
    const result = await list({ prefix: PREFIX, limit: 1000, ...auth });
    return result.blobs.length;
  } catch {
    return 0;
  }
}
