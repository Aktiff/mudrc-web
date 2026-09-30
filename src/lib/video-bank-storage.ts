import fs from "fs";
import path from "path";
import {
  createVideoBankItem,
  parseVideoBankList,
  videoClipKey,
  videoIdentityFromQuestionFields,
  VideoClipDuplicateError,
  type NewVideoBankItemInput,
  type VideoBankItem,
  type VideoClipDuplicateConflict,
} from "@/lib/video-bank";
import { readAllLibraryQuizzes } from "@/lib/quiz-library-storage";
import { readAppStorageWithFallback, writeAppStorageWithFallback } from "@/lib/app-storage-fallback";

const localPath = path.join(process.cwd(), "src/data/video-bank.local.json");
const BLOB_NAME = "video-bank";

function readLocalVideoBank(): VideoBankItem[] {
  try {
    if (!fs.existsSync(localPath)) return [];
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as { clips?: unknown[] };
    return parseVideoBankList(raw.clips).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeLocalVideoBank(clips: VideoBankItem[]): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify({ clips }, null, 2), "utf-8");
}

export async function readStoredVideoBank(): Promise<VideoBankItem[]> {
  const data = await readAppStorageWithFallback({
    label: "video-bank",
    blobName: BLOB_NAME,
    readLocal: () => ({ clips: readLocalVideoBank() }),
    empty: { clips: [] },
  });
  return parseVideoBankList(data.clips).sort((a, b) => b.createdAt - a.createdAt);
}

export async function writeStoredVideoBank(clips: VideoBankItem[]): Promise<void> {
  const sorted = [...clips].sort((a, b) => b.createdAt - a.createdAt);
  const payload = { clips: sorted };
  await writeAppStorageWithFallback({
    label: "video-bank",
    blobName: BLOB_NAME,
    payload,
    writeLocal: () => writeLocalVideoBank(sorted),
  });
}

export async function findVideoClipConflict(
  label: string,
  answer: string,
  excludeId?: string
): Promise<VideoClipDuplicateConflict | null> {
  const key = videoClipKey(label, answer);
  const bank = await readStoredVideoBank();
  if (
    bank.some(
      (clip) => clip.id !== excludeId && videoClipKey(clip.label, clip.answer) === key
    )
  ) {
    return { source: "bank", label: label.trim(), answer: answer.trim() };
  }

  const quizzes = await readAllLibraryQuizzes();
  for (const quiz of quizzes) {
    for (const question of quiz.questions ?? []) {
      const identity = videoIdentityFromQuestionFields({
        kind: question.kind,
        answer: question.answer,
        bankQuestionId: question.bankQuestionId,
        mediaLabel: question.mediaLabel,
      });
      if (identity?.key === key) {
        return {
          source: "quiz",
          label: identity.label,
          answer: identity.answer,
          quizTitle: quiz.title?.trim() || quiz.id,
        };
      }
    }
  }

  return null;
}

export async function addStoredVideoBankItem(input: NewVideoBankItemInput): Promise<VideoBankItem> {
  const label = input.label.trim();
  const answer = input.answer.trim();
  const conflict = await findVideoClipConflict(label, answer);
  if (conflict) {
    throw new VideoClipDuplicateError(conflict);
  }

  const item = createVideoBankItem({ ...input, label, answer });
  const existing = await readStoredVideoBank();
  await writeStoredVideoBank([item, ...existing.filter((t) => t.id !== item.id)]);
  return item;
}

export async function updateStoredVideoBankItem(
  id: string,
  input: NewVideoBankItemInput
): Promise<VideoBankItem> {
  const label = input.label.trim();
  const answer = input.answer.trim();
  const videoUrl = input.videoUrl.trim();
  if (!label || !answer || !videoUrl) throw new Error("Vyplň popis, odpoveď a video URL.");

  const existing = await readStoredVideoBank();
  const current = existing.find((c) => c.id === id);
  if (!current) throw new Error("NOT_FOUND");

  const conflict = await findVideoClipConflict(label, answer, id);
  if (conflict) throw new VideoClipDuplicateError(conflict);

  const updated: VideoBankItem = {
    ...current,
    label,
    answer,
    videoUrl,
    note: input.note?.trim() || undefined,
  };
  const next = existing.map((c) => (c.id === id ? updated : c));
  await writeStoredVideoBank(next);
  return updated;
}

export async function removeStoredVideoBankItem(id: string): Promise<boolean> {
  const existing = await readStoredVideoBank();
  const next = existing.filter((t) => t.id !== id);
  if (next.length === existing.length) return false;
  await writeStoredVideoBank(next);
  return true;
}
