import fs from "fs";
import path from "path";
import {
  createMusicBankItem,
  musicIdentityFromQuestionFields,
  musicTrackKey,
  MusicTrackDuplicateError,
  normalizeMusicBankItem,
  parseMusicBankList,
  type MusicBankItem,
  type MusicTrackDuplicateConflict,
  type NewMusicBankItemInput,
} from "@/lib/music-bank";
import { enrichMusicTrackAutoTags, lookupMusicTrackAutoTags } from "@/lib/music-track-metadata";
import { readAllLibraryQuizzes } from "@/lib/quiz-library-storage";
import { hasSupabaseStorage, supabaseFetchMusicBank, supabaseSetMusicBank } from "@/lib/supabase-storage";

const localPath = path.join(process.cwd(), "src/data/music-bank.local.json");

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
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchMusicBank();
    if (result.status === "error") throw new Error(result.message);
    if (result.status === "missing") return [];
    return parseMusicBankList(result.value.tracks).sort((a, b) => b.createdAt - a.createdAt);
  }
  return readLocalMusicBank();
}

export async function writeStoredMusicBank(tracks: MusicBankItem[]): Promise<void> {
  const sorted = [...tracks].sort((a, b) => b.createdAt - a.createdAt);
  if (hasSupabaseStorage()) {
    await supabaseSetMusicBank({ tracks: sorted });
    return;
  }
  writeLocalMusicBank(sorted);
}

export async function findMusicTrackConflict(
  artist: string,
  title: string,
  excludeId?: string
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

export async function addStoredMusicBankItem(input: NewMusicBankItemInput): Promise<MusicBankItem> {
  const artist = input.artist.trim();
  const title = input.title.trim();
  const conflict = await findMusicTrackConflict(artist, title);
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
    tags: input.tags?.length ? input.tags : current.tags,
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

export async function removeStoredMusicBankItem(id: string): Promise<boolean> {
  const existing = await readStoredMusicBank();
  const next = existing.filter((t) => t.id !== id);
  if (next.length === existing.length) return false;
  await writeStoredMusicBank(next);
  return true;
}
