import { writeAppStorageBlob, readAppStorageBlob } from "@/lib/blob-app-storage";
import { shouldWriteBlob } from "@/lib/storage";

export async function readAppStorageWithFallback<T>(options: {
  label: string;
  blobName: string;
  readLocal: () => T;
  empty: T;
}): Promise<T> {
  const { blobName, readLocal, empty } = options;

  const fromBlob = await readAppStorageBlob<T>(blobName);
  if (fromBlob !== null && fromBlob !== undefined) {
    if (Array.isArray(fromBlob)) {
      if (fromBlob.length > 0) return fromBlob;
    } else if (typeof fromBlob === "object") {
      const keys = Object.keys(fromBlob as object);
      if (keys.length > 0) return fromBlob;
    } else {
      return fromBlob;
    }
  }

  const local = readLocal();
  if (Array.isArray(local)) {
    if (local.length > 0) return local;
  } else if (local && typeof local === "object") {
    const keys = Object.keys(local as object);
    if (keys.length > 0) return local;
  }

  return empty;
}

export async function writeAppStorageWithFallback(options: {
  label: string;
  blobName: string;
  payload: unknown;
  writeLocal?: () => void;
}): Promise<void> {
  const { label, blobName, payload, writeLocal } = options;

  if (shouldWriteBlob()) {
    await writeAppStorageBlob(blobName, payload);
    return;
  }

  if (writeLocal) {
    writeLocal();
    return;
  }

  throw new Error(`${label}: chýba Vercel Blob — zápis nie je možný.`);
}
