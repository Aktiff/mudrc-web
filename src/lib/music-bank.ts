export const MUSIC_BANK_STORAGE_KEY = "mudrc-music-bank";
export const MUSIC_BANK_ID_PREFIX = "music-bank-";

export type MusicBankItem = {
  id: string;
  artist: string;
  title: string;
  audioUrl: string;
  note?: string;
  createdAt: number;
};

export type NewMusicBankItemInput = {
  artist: string;
  title: string;
  audioUrl: string;
  note?: string;
};

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
    createdAt: Date.now(),
  };
}

export const DEFAULT_MUSIC_QUESTION_BODY =
  "Vypočuj si ukážku (~30 s). Napíš interpreta a názov skladby — každé správne za 1 bod.";

export function formatMusicBankHostNote(item: MusicBankItem): string {
  const parts = [`Interpret: ${item.artist}`, `Skladba: ${item.title}`, "Body: 1 + 1"];
  if (item.note) parts.push(item.note);
  return parts.join(" · ");
}
