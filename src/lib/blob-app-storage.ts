import { del, list } from "@vercel/blob";
import {
  blobAuthOptions,
  optionalReadBlob,
  shouldWriteBlob,
  writeBlob,
  hasBlobStorage,
} from "@/lib/storage";

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
  try {
    await del(blobKey(name), blobAuthOptions());
  } catch {
    // ignore missing blob
  }
}

export async function countAppStorageBlobKeys(): Promise<number> {
  if (!hasBlobStorage()) return 0;
  try {
    const result = await list({ prefix: PREFIX, limit: 1000, ...blobAuthOptions() });
    return result.blobs.length;
  } catch {
    return 0;
  }
}
