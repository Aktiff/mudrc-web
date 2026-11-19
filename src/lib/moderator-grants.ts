import fs from "fs";
import path from "path";
import { readAppStorageBlob, writeAppStorageBlob } from "@/lib/blob-app-storage";
import { findModeratorByUsername } from "@/lib/admin-auth";
import { shouldWriteBlob } from "@/lib/storage";

export type ModeratorGrant = {
  username: string;
  eventSlug: string;
  grantedAt: string;
  grantedBy: string;
};

type Store = { grants: ModeratorGrant[] };

const BLOB_NAME = "moderator-grants";
const localPath = path.join(process.cwd(), "src/data/moderator-grants.local.json");

function readLocal(): Store {
  try {
    if (!fs.existsSync(localPath)) return { grants: [] };
    const data = JSON.parse(fs.readFileSync(localPath, "utf-8")) as Store;
    return { grants: Array.isArray(data.grants) ? data.grants.map(normalizeGrant).filter(Boolean) as ModeratorGrant[] : [] };
  } catch {
    return { grants: [] };
  }
}

function writeLocal(store: Store) {
  fs.writeFileSync(localPath, JSON.stringify(store, null, 2), "utf-8");
}

function normalizeGrant(raw: unknown): ModeratorGrant | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const username = String(row.username ?? "").trim();
  const eventSlug = String(row.eventSlug ?? "").trim();
  const grantedAt = String(row.grantedAt ?? "").trim();
  const grantedBy = String(row.grantedBy ?? "owner").trim() || "owner";
  if (!username || !eventSlug || !grantedAt) return null;
  if (!findModeratorByUsername(username)) return null;
  return { username, eventSlug, grantedAt, grantedBy };
}

async function loadStore(): Promise<Store> {
  const fromBlob = await readAppStorageBlob<Store>(BLOB_NAME);
  if (fromBlob && Array.isArray(fromBlob.grants)) {
    return {
      grants: fromBlob.grants.map(normalizeGrant).filter(Boolean) as ModeratorGrant[],
    };
  }
  return readLocal();
}

async function saveStore(store: Store): Promise<void> {
  if (shouldWriteBlob()) {
    await writeAppStorageBlob(BLOB_NAME, store);
    return;
  }
  if (process.env.VERCEL) {
    throw new Error("BLOB_NOT_CONFIGURED");
  }
  writeLocal(store);
}

export async function readModeratorGrants(): Promise<ModeratorGrant[]> {
  return (await loadStore()).grants;
}

export async function listGrantsForEvent(eventSlug: string): Promise<ModeratorGrant[]> {
  const slug = eventSlug.trim();
  return (await readModeratorGrants()).filter((grant) => grant.eventSlug === slug);
}

export async function listGrantedEventSlugs(username: string): Promise<string[]> {
  const key = username.trim().toLowerCase();
  const slugs = (await readModeratorGrants())
    .filter((grant) => grant.username.toLowerCase() === key)
    .map((grant) => grant.eventSlug);
  return Array.from(new Set(slugs));
}

export async function getGrant(username: string, eventSlug: string): Promise<ModeratorGrant | null> {
  const key = username.trim().toLowerCase();
  const slug = eventSlug.trim();
  return (
    (await readModeratorGrants()).find(
      (grant) => grant.username.toLowerCase() === key && grant.eventSlug === slug
    ) ?? null
  );
}

export async function grantModeratorAccess(input: {
  username: string;
  eventSlug: string;
  grantedBy?: string;
}): Promise<ModeratorGrant> {
  const user = findModeratorByUsername(input.username);
  if (!user) {
    throw new Error("UNKNOWN_MODERATOR");
  }
  const eventSlug = input.eventSlug.trim();
  if (!eventSlug) {
    throw new Error("MISSING_EVENT");
  }

  const store = await loadStore();
  const existing = store.grants.find(
    (grant) =>
      grant.username.toLowerCase() === user.username.toLowerCase() && grant.eventSlug === eventSlug
  );
  if (existing) return existing;

  const grant: ModeratorGrant = {
    username: user.username,
    eventSlug,
    grantedAt: new Date().toISOString(),
    grantedBy: input.grantedBy?.trim() || "owner",
  };
  store.grants.push(grant);
  await saveStore(store);
  return grant;
}

export async function revokeModeratorAccess(username: string, eventSlug: string): Promise<boolean> {
  const key = username.trim().toLowerCase();
  const slug = eventSlug.trim();
  const store = await loadStore();
  const next = store.grants.filter(
    (grant) => !(grant.username.toLowerCase() === key && grant.eventSlug === slug)
  );
  if (next.length === store.grants.length) return false;
  await saveStore({ grants: next });
  return true;
}

/** Moderator may act on this event only if an explicit grant exists. */
export async function moderatorCanAccessEvent(username: string, eventSlug: string): Promise<boolean> {
  return !!(await getGrant(username, eventSlug));
}

/**
 * Moderator may create a new score table only on a granted event.
 * Edits require ownership of the save and that the save happened after the grant
 * (no retroactive edits of older quizzes).
 */
export async function moderatorCanSaveNewScores(username: string, eventSlug: string): Promise<boolean> {
  return moderatorCanAccessEvent(username, eventSlug);
}

export async function moderatorCanEditSavedScores(
  username: string,
  eventSlug: string,
  savedBy: string | undefined | null,
  savedAt: string | undefined | null
): Promise<boolean> {
  const grant = await getGrant(username, eventSlug);
  if (!grant) return false;
  if (!savedBy || savedBy.toLowerCase() !== username.trim().toLowerCase()) return false;
  if (!savedAt) return false;
  const savedMs = Date.parse(savedAt);
  const grantedMs = Date.parse(grant.grantedAt);
  if (!Number.isFinite(savedMs) || !Number.isFinite(grantedMs)) return false;
  return savedMs >= grantedMs;
}
