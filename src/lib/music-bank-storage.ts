import fs from "fs";
import path from "path";
import {
  createMusicBankItem,
  musicBankInputFromReturnedAudio,
  musicIdentityFromQuestionFields,
  musicTrackKey,
  MusicTrackDuplicateError,
  parseMusicBankList,
  type MusicBankItem,
  type MusicTrackDuplicateConflict,
  type NewMusicBankItemInput,
} from "@/lib/music-bank";
import { readStoredSoundBank, removeStoredSoundBankItem } from "@/lib/sound-bank-storage";
import { enrichMusicTrackAutoTags, lookupMusicTrackAutoTags } from "@/lib/music-track-metadata";
import { readAllLibraryQuizzes } from "@/lib/quiz-library-storage";
import { readAppStorageWithFallback, writeAppStorageWithFallback } from "@/lib/app-storage-fallback";

const localPath = path.join(process.cwd(), "src/data/music-bank.local.json");
const BLOB_NAME = "music-bank";

function readLocalMusicBank(): MusicBankItem[] {
  try {
    if (!fs.existsSync(localPath)) return [];
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as { tracks?: unknown[] };
    return parseMusicBankList(raw.tracks).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeLocalMusicBank(tracks: MusicBankItem[]): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify({ tracks }, null, 2), "utf-8");
}

export async function readStoredMusicBank(): Promise<MusicBankItem[]> {
  const data = await readAppStorageWithFallback({
    label: "music-bank",
    blobName: BLOB_NAME,
    readLocal: () => ({ tracks: readLocalMusicBank() }),
    empty: { tracks: [] },
  });
  return parseMusicBankList(data.tracks).sort((a, b) => b.createdAt - a.createdAt);
}

export async function writeStoredMusicBank(tracks: MusicBankItem[]): Promise<void> {
  const sorted = [...tracks].sort((a, b) => b.createdAt - a.createdAt);
  const payload = { tracks: sorted };
  await writeAppStorageWithFallback({
    label: "music-bank",
    blobName: BLOB_NAME,
    payload,
    writeLocal: () => writeLocalMusicBank(sorted),
  });
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

  const quizzes = await readAllLibraryQuizzes();
  for (const quiz of quizzes) {
    if (ignoreQuizId && quiz.id === ignoreQuizId) continue;
    for (const question of quiz.questions ?? []) {
      const identity = musicIdentityFromQuestionFields(question);
      if (identity?.key === key) {
        return {
          source: "quiz",
          artist: identity.artist,
          title: identity.title,
          quizTitle: quiz.title?.trim() || quiz.id,
        };
      }
    }
  }

  return null;
}

export async function addStoredMusicBankItem(
  input: NewMusicBankItemInput,
  ignoreQuizId?: string
): Promise<MusicBankItem> {
  const artist = input.artist.trim();
  const title = input.title.trim();
  const conflict = await findMusicTrackConflict(artist, title, undefined, ignoreQuizId);
  if (conflict) {
    throw new MusicTrackDuplicateError(conflict);
  }

  const autoTags =
    input.tags?.length ? input.tags : await lookupMusicTrackAutoTags(artist, title);
  const item = createMusicBankItem({ ...input, artist, title, tags: autoTags });
  const existing = await readStoredMusicBank();
  await writeStoredMusicBank([item, ...existing.filter((t) => t.id !== item.id)]);
  return item;
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

  const updated = createMusicBankItem({
    ...input,
    artist,
    title,
    audioUrl,
    tags: Array.isArray(input.tags) ? input.tags : current.tags,
  });
  const merged: MusicBankItem = { ...updated, id: current.id, createdAt: current.createdAt };
  const next = existing.map((t) => (t.id === id ? merged : t));
  await writeStoredMusicBank(next);
  return merged;
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
  const existing = await readStoredMusicBank();
  const next = existing.filter((t) => t.id !== id);
  if (next.length === existing.length) return false;
  await writeStoredMusicBank(next);
  return true;
}
