import { normalizeTags } from "@/lib/quiz-question-tags";

export const MUSIC_BANK_STORAGE_KEY = "mudrc-music-bank";
export const MUSIC_BANK_ID_PREFIX = "music-bank-";

export type MusicBankItem = {
  id: string;
  artist: string;
  title: string;
  audioUrl: string;
  note?: string;
  /** Jazyk, štýl, dekáda — doplnené pri uploade z MusicBrainz. */
  tags?: string[];
  createdAt: number;
};

export type NewMusicBankItemInput = {
  artist: string;
  title: string;
  audioUrl: string;
  note?: string;
  tags?: string[];
};

export type MusicTrackDuplicateSource = "bank" | "quiz";

export type MusicTrackDuplicateConflict = {
  source: MusicTrackDuplicateSource;
  artist: string;
  title: string;
  quizTitle?: string;
};

function normalizeMusicTrackPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Jednoznačný kľúč skladby pre kontrolu duplicít. */
export function musicTrackKey(artist: string, title: string): string {
  return `${normalizeMusicTrackPart(artist)}|${normalizeMusicTrackPart(title)}`;
}

export function formatMusicTrackLabel(artist: string, title: string): string {
  return `${artist.trim()} — ${title.trim()}`;
}

export function formatMusicTrackDuplicateMessage(conflict: MusicTrackDuplicateConflict): string {
  const label = formatMusicTrackLabel(conflict.artist, conflict.title);
  if (conflict.source === "bank") {
    return `Skladba „${label}“ už je v banke hudby.`;
  }
  return `Skladba „${label}“ už je v kvíze „${conflict.quizTitle ?? "?"}" — nemôže byť v dvoch kvízoch.`;
}

export class MusicTrackDuplicateError extends Error {
  readonly conflict: MusicTrackDuplicateConflict;

  constructor(conflict: MusicTrackDuplicateConflict) {
    super(formatMusicTrackDuplicateMessage(conflict));
    this.name = "MusicTrackDuplicateError";
    this.conflict = conflict;
  }
}

export function isMusicBankId(id: string): boolean {
  return id.startsWith(MUSIC_BANK_ID_PREFIX);
}

export function normalizeMusicBankItem(raw: unknown): MusicBankItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || !isMusicBankId(row.id)) return null;
  const artist = typeof row.artist === "string" ? row.artist.trim() : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const audioUrl = typeof row.audioUrl === "string" ? row.audioUrl.trim() : "";
  if (!artist || !title || !audioUrl) return null;

  return {
    id: row.id,
    artist,
    title,
    audioUrl,
    note: typeof row.note === "string" ? row.note.trim() : undefined,
    tags: normalizeTags(row.tags),
    createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
  };
}

export function parseMusicBankList(raw: unknown): MusicBankItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MusicBankItem[] = [];
  for (const row of raw) {
    const item = normalizeMusicBankItem(row);
    if (item) out.push(item);
  }
  return out;
}

export function createMusicBankItem(input: NewMusicBankItemInput): MusicBankItem {
  return {
    id: `${MUSIC_BANK_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    artist: input.artist.trim(),
    title: input.title.trim(),
    audioUrl: input.audioUrl.trim(),
    note: input.note?.trim() || undefined,
    tags: normalizeTags(input.tags),
    createdAt: Date.now(),
  };
}

export const DEFAULT_MUSIC_QUESTION_BODY = "Napíš meno interpreta a názov skladby";

export function formatMusicBankHostNote(item: MusicBankItem): string {
  const parts = [`Interpret: ${item.artist}`, `Skladba: ${item.title}`, "Body: 1 + 1"];
  if (item.tags?.length) parts.push(`Tagy: ${item.tags.join(", ")}`);
  if (item.note) parts.push(item.note);
  return parts.join(" · ");
}

export function formatMusicBankTagsLabel(tags: string[] | undefined): string {
  if (!tags?.length) return "";
  return tags.join(" · ");
}

const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|aac)$/i;

function humanizeMusicNamePart(raw: string): string {
  return raw.trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

/**
 * Z názvu súboru „The Beatles - Help!.mp3“ alebo „Kryštof, Tomáš Klus - Cesta.mp3“.
 */
export function musicIdentityFromQuestionFields(input: {
  kind?: string;
  musicArtist?: string;
  musicTitle?: string;
  answer?: string;
  bankQuestionId?: string;
}): { artist: string; title: string; key: string } | null {
  if (input.kind !== "music" && !isMusicBankId(input.bankQuestionId ?? "")) {
    return null;
  }

  let artist = input.musicArtist?.trim() ?? "";
  let title = input.musicTitle?.trim() ?? "";

  if (!artist || !title) {
    const answer = input.answer?.trim() ?? "";
    const match = answer.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (match) {
      if (!artist) artist = match[1].trim();
      if (!title) title = match[2].trim();
    }
  }

  if (!artist || !title) return null;

  return { artist, title, key: musicTrackKey(artist, title) };
}

export function parseMusicTrackFromFileName(fileName: string): { artist: string; title: string } | null {
  const base = fileName.replace(AUDIO_EXT, "").trim();
  if (!base) return null;

  const match = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!match) return null;

  const artist = humanizeMusicNamePart(match[1]);
  const title = humanizeMusicNamePart(match[2]);
  if (!artist || !title) return null;

  return { artist, title };
}
