export const SOUND_BANK_ID_PREFIX = "sound-bank-";

export type SoundBankItem = {
  id: string;
  /** Krátky popis pre teba v banke (napr. „Trump“) */
  label: string;
  answer: string;
  audioUrl: string;
  note?: string;
  createdAt: number;
};

export type NewSoundBankItemInput = {
  label: string;
  answer: string;
  audioUrl: string;
  note?: string;
};

export type SoundClipDuplicateConflict = {
  source: "bank" | "quiz";
  label: string;
  answer: string;
  quizTitle?: string;
};

const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|aac)$/i;

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function soundClipKey(label: string, answer: string): string {
  return `${normalizeKeyPart(label)}|${normalizeKeyPart(answer)}`;
}

export function formatSoundClipDuplicateMessage(conflict: SoundClipDuplicateConflict): string {
  const label = `${conflict.label.trim()} → ${conflict.answer.trim()}`;
  if (conflict.source === "bank") {
    return `Zvuková ukážka „${label}“ už je v banke.`;
  }
  return `Zvuková ukážka „${label}“ už je v kvíze „${conflict.quizTitle ?? "?"}" — nemôže byť v dvoch kvízoch.`;
}

export class SoundClipDuplicateError extends Error {
  readonly conflict: SoundClipDuplicateConflict;

  constructor(conflict: SoundClipDuplicateConflict) {
    super(formatSoundClipDuplicateMessage(conflict));
    this.name = "SoundClipDuplicateError";
    this.conflict = conflict;
  }
}

export function isSoundBankId(id: string): boolean {
  return id.startsWith(SOUND_BANK_ID_PREFIX);
}

export function normalizeSoundBankItem(raw: unknown): SoundBankItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || !isSoundBankId(row.id)) return null;
  const label = typeof row.label === "string" ? row.label.trim() : "";
  const answer = typeof row.answer === "string" ? row.answer.trim() : "";
  const audioUrl = typeof row.audioUrl === "string" ? row.audioUrl.trim() : "";
  if (!label || !answer || !audioUrl) return null;

  return {
    id: row.id,
    label,
    answer,
    audioUrl,
    note: typeof row.note === "string" ? row.note.trim() : undefined,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
  };
}

export function parseSoundBankList(raw: unknown): SoundBankItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SoundBankItem[] = [];
  for (const row of raw) {
    const item = normalizeSoundBankItem(row);
    if (item) out.push(item);
  }
  return out;
}

export function createSoundBankItem(input: NewSoundBankItemInput): SoundBankItem {
  return {
    id: `${SOUND_BANK_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: input.label.trim(),
    answer: input.answer.trim(),
    audioUrl: input.audioUrl.trim(),
    note: input.note?.trim() || undefined,
    createdAt: Date.now(),
  };
}

export const DEFAULT_SOUND_QUESTION_BODY = "Čí je to hlas?";

export function formatSoundBankHostNote(item: SoundBankItem): string {
  const parts = [`Odpoveď: ${item.answer}`, `Popis: ${item.label}`];
  if (item.note) parts.push(item.note);
  return parts.join(" · ");
}

function humanizeNamePart(raw: string): string {
  return raw.trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

export function parseSoundClipFromFileName(fileName: string): { label: string; answer: string } | null {
  const base = fileName.replace(AUDIO_EXT, "").trim();
  if (!base) return null;

  const match = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (match) {
    const label = humanizeNamePart(match[1]);
    const answer = humanizeNamePart(match[2]);
    if (label && answer) return { label, answer };
  }

  const single = humanizeNamePart(base);
  if (!single) return null;
  return { label: single, answer: single };
}

export function soundIdentityFromQuestionFields(input: {
  kind?: string;
  answer?: string;
  bankQuestionId?: string;
  mediaLabel?: string;
}): { label: string; answer: string; key: string } | null {
  if (input.kind !== "sound" && !isSoundBankId(input.bankQuestionId ?? "")) {
    return null;
  }
  const answer = input.answer?.trim() ?? "";
  const label = input.mediaLabel?.trim() || answer;
  if (!answer) return null;
  return { label, answer, key: soundClipKey(label, answer) };
}
