import fs from "fs";
import path from "path";
import {
  createMusicBankItem,
  formatMusicTrackDuplicateMessage,
  musicBankInputFromReturnedAudio,
  musicTrackKey,
  MusicTrackDuplicateError,
  parseMusicBankList,
  type MusicBankItem,
  type MusicTrackDuplicateConflict,
  type NewMusicBankItemInput,
} from "@/lib/music-bank";
import { readStoredSoundBank, removeStoredSoundBankItem } from "@/lib/sound-bank-storage";
import {
  enrichMusicTrackAutoTags,
  lookupMusicTrackTagsForUpload,
  parseMusicBankTagBuckets,
} from "@/lib/music-track-metadata";
import { findQuizTitleUsingMusicTrack } from "@/lib/quiz-library-storage";
import { readAppStorageWithFallback, writeAppStorageWithFallback } from "@/lib/app-storage-fallback";
import { readLatestAppStorageBlob } from "@/lib/blob-app-storage";
import { hasBlobStorage } from "@/lib/storage";

const localPath = path.join(process.cwd(), "src/data/music-bank.local.json");
const BLOB_NAME = "music-bank";
const DELETED_CAP = 2000;

type MusicBankFile = {
  tracks?: unknown;
  deletedIds?: string[];
};

function sortTracks(tracks: MusicBankItem[]): MusicBankItem[] {
  return [...tracks].sort((a, b) => b.createdAt - a.createdAt);
}

function deletedIdsOf(file: MusicBankFile | null | undefined): string[] {
  if (!file || !Array.isArray(file.deletedIds)) return [];
  return file.deletedIds.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, DELETED_CAP);
}

function readLocalFile(): MusicBankFile {
  try {
    if (!fs.existsSync(localPath)) return { tracks: [] };
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as MusicBankFile;
    return raw && typeof raw === "object" ? raw : { tracks: [] };
  } catch {
    return { tracks: [] };
  }
}

function writeLocalFile(file: MusicBankFile): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(file, null, 2), "utf-8");
}

async function readMusicFile(): Promise<MusicBankFile> {
  if (hasBlobStorage()) {
    const latest = await readLatestAppStorageBlob<MusicBankFile>(BLOB_NAME);
    if (latest && typeof latest === "object" && !Array.isArray(latest)) return latest;
  }
  return readAppStorageWithFallback<MusicBankFile>({
    label: "music-bank",
    blobName: BLOB_NAME,
    readLocal: readLocalFile,
    empty: { tracks: [] },
  });
}

async function writeMusicFile(tracks: MusicBankItem[], deletedIds: string[]): Promise<void> {
  const file: MusicBankFile = {
    tracks: sortTracks(tracks),
    deletedIds: deletedIds.slice(0, DELETED_CAP),
  };
  await writeAppStorageWithFallback({
    label: "music-bank",
    blobName: BLOB_NAME,
    payload: file,
    writeLocal: () => writeLocalFile(file),
  });
}

function visibleTracks(file: MusicBankFile): MusicBankItem[] {
  const deleted = new Set(deletedIdsOf(file));
  return parseMusicBankList(file.tracks).filter((track) => !deleted.has(track.id));
}

export async function readStoredMusicBank(): Promise<MusicBankItem[]> {
  const file = await readMusicFile();
  return sortTracks(visibleTracks(file));
}

/** Zapíše banku a nenechá vypadnúť skladbu, ktorá v nej ešte je a nebola zmazaná. */
export async function writeStoredMusicBank(tracks: MusicBankItem[]): Promise<void> {
  const file = await readMusicFile();
  const deleted = new Set(deletedIdsOf(file));
  const byId = new Map<string, MusicBankItem>();
  for (const track of visibleTracks(file)) byId.set(track.id, track);
  for (const track of tracks) {
    if (!deleted.has(track.id)) byId.set(track.id, track);
  }
  await writeMusicFile(Array.from(byId.values()), Array.from(deleted));
}

export async function findMusicTrackConflict(
  artist: string,
  title: string,
  excludeId?: string,
  ignoreQuizId?: string
): Promise<MusicTrackDuplicateConflict | null> {
  const key = musicTrackKey(artist, title);
  const bank = await readStoredMusicBank();
  if (
    bank.some(
      (track) => track.id !== excludeId && musicTrackKey(track.artist, track.title) === key
    )
  ) {
    return { source: "bank", artist: artist.trim(), title: title.trim() };
  }

  const quizTitle = await findQuizTitleUsingMusicTrack(key, ignoreQuizId);
  if (quizTitle) {
    return { source: "quiz", artist: artist.trim(), title: title.trim(), quizTitle };
  }

  return null;
}

export async function addStoredMusicBankItems(
  inputs: NewMusicBankItemInput[],
  ignoreQuizId?: string
): Promise<{
  added: MusicBankItem[];
  errors: { artist: string; title: string; error: string; conflict?: MusicTrackDuplicateConflict }[];
}> {
  const existing = await readStoredMusicBank();
  const next = [...existing];
  const added: MusicBankItem[] = [];
  const errors: { artist: string; title: string; error: string; conflict?: MusicTrackDuplicateConflict }[] = [];
  const tagsByKey = new Map<string, string[]>();
  await Promise.all(
    inputs.map(async (input) => {
      const artist = input.artist?.trim() ?? "";
      const title = input.title?.trim() ?? "";
      if (!artist || !title || input.tags?.length) return;
      const tags = await lookupMusicTrackTagsForUpload(artist, title);
      tagsByKey.set(musicTrackKey(artist, title), tags);
    })
  );

  for (const input of inputs) {
    const artist = input.artist?.trim() ?? "";
    const title = input.title?.trim() ?? "";
    const audioUrl = input.audioUrl?.trim() ?? "";
    if (!artist || !title || !audioUrl) {
      errors.push({ artist, title, error: "Chýba interpret, názov alebo audio." });
      continue;
    }
    const key = musicTrackKey(artist, title);
    if (next.some((track) => musicTrackKey(track.artist, track.title) === key)) {
      const conflict: MusicTrackDuplicateConflict = { source: "bank", artist, title };
      errors.push({ artist, title, error: formatMusicTrackDuplicateMessage(conflict), conflict });
      continue;
    }
    const quizTitle = await findQuizTitleUsingMusicTrack(key, ignoreQuizId);
    if (quizTitle) {
      const conflict: MusicTrackDuplicateConflict = { source: "quiz", artist, title, quizTitle };
      errors.push({ artist, title, error: formatMusicTrackDuplicateMessage(conflict), conflict });
      continue;
    }
    const autoTags = input.tags?.length
      ? input.tags
      : tagsByKey.get(key) ?? [];
    const item = createMusicBankItem({ ...input, artist, title, audioUrl, tags: autoTags });
    next.unshift(item);
    added.push(item);
  }

  if (added.length) await writeStoredMusicBank(next);
  return { added, errors };
}

export async function addStoredMusicBankItem(
  input: NewMusicBankItemInput,
  ignoreQuizId?: string
): Promise<MusicBankItem> {
  const { added, errors } = await addStoredMusicBankItems([input], ignoreQuizId);
  const failed = errors[0];
  if (!added[0]) {
    if (failed?.conflict) throw new MusicTrackDuplicateError(failed.conflict);
    throw new Error(failed?.error ?? "Uloženie zlyhalo");
  }
  return added[0];
}

export async function updateStoredMusicBankItem(
  id: string,
  input: NewMusicBankItemInput
): Promise<MusicBankItem> {
  const artist = input.artist.trim();
  const title = input.title.trim();
  const audioUrl = input.audioUrl.trim();
  if (!artist || !title || !audioUrl) throw new Error("Vyplň interpreta, názov a audio URL.");

  const existing = await readStoredMusicBank();
  const current = existing.find((t) => t.id === id);
  if (!current) throw new Error("NOT_FOUND");

  const conflict = await findMusicTrackConflict(artist, title, id);
  if (conflict) throw new MusicTrackDuplicateError(conflict);

  const audioChanged = audioUrl !== current.audioUrl;
  const updated = createMusicBankItem({
    ...input,
    artist,
    title,
    audioUrl,
    tags: Array.isArray(input.tags) ? input.tags : current.tags,
    presentationFade: audioChanged ? input.presentationFade === true : current.presentationFade === true,
  });
  const merged: MusicBankItem = { ...updated, id: current.id, createdAt: current.createdAt };
  const next = existing.map((t) => (t.id === id ? merged : t));
  await writeStoredMusicBank(next);
  return merged;
}

/** Doplní štýl a dekádu skladbám, ktorým pri nahratí chýbajú. Najviac `limit` naraz. */
export async function fillMissingStoredMusicTags(ids: string[], limit = 4): Promise<MusicBankItem[]> {
  const wanted = new Set(ids.filter(Boolean).slice(0, limit));
  const existing = await readStoredMusicBank();
  const missing = existing
    .filter((track) => {
      if (!wanted.has(track.id)) return false;
      const buckets = parseMusicBankTagBuckets(track.tags ?? []);
      return !buckets.style || !buckets.decade;
    })
    .slice(0, limit);
  if (!missing.length) return existing;

  const updated = new Map<string, MusicBankItem>();
  await Promise.all(
    missing.map(async (track) => {
      const tags = await Promise.race([
        enrichMusicTrackAutoTags(track.artist, track.title, track.tags),
        new Promise<string[]>((resolve) => {
          setTimeout(() => resolve(track.tags ?? []), 8000);
        }),
      ]);
      updated.set(track.id, { ...track, tags });
    })
  );

  await writeStoredMusicBank(Array.from(updated.values()));
  return readStoredMusicBank();
}

export async function refreshStoredMusicBankItemTags(id: string): Promise<MusicBankItem> {
  const existing = await readStoredMusicBank();
  const current = existing.find((t) => t.id === id);
  if (!current) throw new Error("NOT_FOUND");

  const tags = await enrichMusicTrackAutoTags(current.artist, current.title, current.tags);
  const merged: MusicBankItem = { ...current, tags };
  const next = existing.map((t) => (t.id === id ? merged : t));
  await writeStoredMusicBank(next);
  return merged;
}

let rehomeInflight: Promise<void> | null = null;

/** Pieseň vrátená z kvízu sa omylom ukladala medzi iné ukážky. Presunie ju späť. */
export function rehomeMusicTracksLeftInSoundBank(): Promise<void> {
  if (!rehomeInflight) {
    rehomeInflight = moveReturnedMusicOutOfSoundBank().finally(() => {
      rehomeInflight = null;
    });
  }
  return rehomeInflight;
}

async function moveReturnedMusicOutOfSoundBank(): Promise<void> {
  const clips = await readStoredSoundBank();
  for (const clip of clips) {
    const restored = musicBankInputFromReturnedAudio({
      label: clip.label,
      answer: clip.answer,
      audioUrl: clip.audioUrl,
      hostNote: clip.note,
    });
    if (!restored) continue;
    const existing = await readStoredMusicBank();
    const key = musicTrackKey(restored.artist, restored.title);
    if (!existing.some((track) => musicTrackKey(track.artist, track.title) === key)) {
      const item = createMusicBankItem(restored);
      await writeStoredMusicBank([item, ...existing]);
    }
    await removeStoredSoundBankItem(clip.id);
  }
}

export async function removeStoredMusicBankItem(id: string): Promise<boolean> {
  const file = await readMusicFile();
  const current = visibleTracks(file);
  const next = current.filter((track) => track.id !== id);
  const deletedIds = Array.from(new Set([...deletedIdsOf(file), id]));
  await writeMusicFile(next, deletedIds);
  return next.length !== current.length;
}
