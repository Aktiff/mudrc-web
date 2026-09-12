export const VIDEO_BANK_ID_PREFIX = "video-bank-";

export type VideoBankItem = {
  id: string;
  label: string;
  answer: string;
  videoUrl: string;
  note?: string;
  createdAt: number;
};

export type NewVideoBankItemInput = {
  label: string;
  answer: string;
  videoUrl: string;
  note?: string;
};

export type VideoClipDuplicateConflict = {
  source: "bank" | "quiz";
  label: string;
  answer: string;
  quizTitle?: string;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function videoClipKey(label: string, answer: string): string {
  return `${normalizeKeyPart(label)}|${normalizeKeyPart(answer)}`;
}

export function formatVideoClipDuplicateMessage(conflict: VideoClipDuplicateConflict): string {
  const label = `${conflict.label.trim()} → ${conflict.answer.trim()}`;
  if (conflict.source === "bank") {
    return `Video ukážka „${label}“ už je v banke.`;
  }
  return `Video ukážka „${label}“ už je v kvíze „${conflict.quizTitle ?? "?"}" — nemôže byť v dvoch kvízoch.`;
}

export class VideoClipDuplicateError extends Error {
  readonly conflict: VideoClipDuplicateConflict;

  constructor(conflict: VideoClipDuplicateConflict) {
    super(formatVideoClipDuplicateMessage(conflict));
    this.name = "VideoClipDuplicateError";
    this.conflict = conflict;
  }
}

export function isVideoBankId(id: string): boolean {
  return id.startsWith(VIDEO_BANK_ID_PREFIX);
}

export function normalizeVideoBankItem(raw: unknown): VideoBankItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || !isVideoBankId(row.id)) return null;
  const label = typeof row.label === "string" ? row.label.trim() : "";
  const answer = typeof row.answer === "string" ? row.answer.trim() : "";
  const videoUrl = typeof row.videoUrl === "string" ? row.videoUrl.trim() : "";
  if (!label || !answer || !videoUrl) return null;

  return {
    id: row.id,
    label,
    answer,
    videoUrl,
    note: typeof row.note === "string" ? row.note.trim() : undefined,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
  };
}

export function parseVideoBankList(raw: unknown): VideoBankItem[] {
  if (!Array.isArray(raw)) return [];
  const out: VideoBankItem[] = [];
  for (const row of raw) {
    const item = normalizeVideoBankItem(row);
    if (item) out.push(item);
  }
  return out;
}

export function createVideoBankItem(input: NewVideoBankItemInput): VideoBankItem {
  return {
    id: `${VIDEO_BANK_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: input.label.trim(),
    answer: input.answer.trim(),
    videoUrl: input.videoUrl.trim(),
    note: input.note?.trim() || undefined,
    createdAt: Date.now(),
  };
}

export const DEFAULT_VIDEO_QUESTION_BODY = "Z akého filmu (seriálu) je táto ukážka?";

export function formatVideoBankHostNote(item: VideoBankItem): string {
  const parts = [`Odpoveď: ${item.answer}`, `Popis: ${item.label}`];
  if (item.note) parts.push(item.note);
  return parts.join(" · ");
}

function humanizeNamePart(raw: string): string {
  return raw.trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

export function parseVideoClipFromFileName(fileName: string): { label: string; answer: string } | null {
  const base = fileName.replace(VIDEO_EXT, "").trim();
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

export function videoIdentityFromQuestionFields(input: {
  kind?: string;
  answer?: string;
  bankQuestionId?: string;
  mediaLabel?: string;
}): { label: string; answer: string; key: string } | null {
  if (input.kind !== "video" && !isVideoBankId(input.bankQuestionId ?? "")) {
    return null;
  }
  const answer = input.answer?.trim() ?? "";
  const label = input.mediaLabel?.trim() || answer;
  if (!answer) return null;
  return { label, answer, key: videoClipKey(label, answer) };
}
