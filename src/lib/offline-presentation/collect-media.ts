import { bestPresentationImageUrl } from "@/lib/quiz-presentation";
import { resolveMediaSrc } from "@/lib/media-url";
import type { QuizLibraryItem } from "@/lib/quiz-library";

/** Unique absolute-or-app media URLs needed to play a quiz offline. */
export function collectQuizMediaUrls(quiz: QuizLibraryItem): string[] {
  const found = new Set<string>();

  const add = (raw: string | undefined) => {
    const trimmed = raw?.trim();
    if (!trimmed) return;
    const resolved = bestPresentationImageUrl(trimmed);
    const src = resolveMediaSrc(resolved) ?? resolved;
    if (src) found.add(src);
  };

  for (const question of quiz.questions ?? []) {
    add(question.imageUrl);
    add(question.audioUrl);
    add(question.videoUrl);
  }
  for (const promo of quiz.promos ?? []) {
    add(promo.imageUrl);
  }

  return Array.from(found);
}

export function extensionForUrl(url: string, contentType?: string): string {
  const pathOnly = url.split("?")[0]?.split("#")[0] ?? url;
  const match = pathOnly.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (match) return match[1].toLowerCase();

  const type = (contentType ?? "").toLowerCase();
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("webm")) return "webm";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("svg")) return "svg";
  return "bin";
}

export function safeMediaFileName(index: number, url: string, contentType?: string): string {
  const ext = extensionForUrl(url, contentType);
  return `asset-${String(index + 1).padStart(3, "0")}.${ext}`;
}
