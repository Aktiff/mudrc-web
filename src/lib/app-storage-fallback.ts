import { writeAppStorageBlob, readAppStorageBlob } from "@/lib/blob-app-storage";
import { shouldWriteBlob } from "@/lib/storage";
import {
  canUseSupabaseStorage,
  isSupabaseRestrictedMessage,
  type SupabaseFetchResult,
} from "@/lib/supabase-storage";

export async function readAppStorageWithFallback<T>(options: {
  label: string;
  blobName: string;
  fetchSupabase: () => Promise<SupabaseFetchResult<T>>;
  readLocal: () => T;
  empty: T;
}): Promise<T> {
  const { label, blobName, fetchSupabase, readLocal, empty } = options;

  if (canUseSupabaseStorage()) {
    const result = await fetchSupabase();
    if (result.status === "ok") return result.value;
    if (result.status === "error") {
      console.error(`${label} Supabase chyba (${result.message}) — skúšam Blob / local.`);
    }
  }

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
  writeSupabase: () => Promise<void>;
  writeLocal?: () => void;
}): Promise<void> {
  const { label, blobName, payload, writeSupabase, writeLocal } = options;

  if (canUseSupabaseStorage()) {
    try {
      await writeSupabase();
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${label} Supabase zápis zlyhal:`, msg);
      if (!isSupabaseRestrictedMessage(msg)) throw error;
    }
  }

  if (shouldWriteBlob()) {
    await writeAppStorageBlob(blobName, payload);
    return;
  }

  if (writeLocal) {
    writeLocal();
    return;
  }

  throw new Error(
    `${label}: Supabase je vypnutý a BLOB_READ_WRITE_TOKEN vo Verceli chýba — zápis nie je možný.`
  );
}
