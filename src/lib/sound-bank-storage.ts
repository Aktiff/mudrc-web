import fs from "fs";
import path from "path";
import {
  createSoundBankItem,
  normalizeSoundBankItem,
  parseSoundBankList,
  soundClipKey,
  soundIdentityFromQuestionFields,
  SoundClipDuplicateError,
  type NewSoundBankItemInput,
  type SoundBankItem,
  type SoundClipDuplicateConflict,
} from "@/lib/sound-bank";
import { readAllLibraryQuizzes } from "@/lib/quiz-library-storage";
import { hasSupabaseStorage, supabaseFetchSoundBank, supabaseSetSoundBank } from "@/lib/supabase-storage";

const localPath = path.join(process.cwd(), "src/data/sound-bank.local.json");

function readLocalSoundBank(): SoundBankItem[] {
  try {
    if (!fs.existsSync(localPath)) return [];
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as { clips?: unknown[] };
    return parseSoundBankList(raw.clips).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeLocalSoundBank(clips: SoundBankItem[]): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify({ clips }, null, 2), "utf-8");
}

export async function readStoredSoundBank(): Promise<SoundBankItem[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchSoundBank();
    if (result.status === "error") throw new Error(result.message);
    if (result.status === "missing") return [];
    return parseSoundBankList(result.value.clips).sort((a, b) => b.createdAt - a.createdAt);
  }
  return readLocalSoundBank();
}

export async function writeStoredSoundBank(clips: SoundBankItem[]): Promise<void> {
  const sorted = [...clips].sort((a, b) => b.createdAt - a.createdAt);
  if (hasSupabaseStorage()) {
    await supabaseSetSoundBank({ clips: sorted });
    return;
  }
  writeLocalSoundBank(sorted);
}

export async function findSoundClipConflict(
  label: string,
  answer: string,
  excludeId?: string
): Promise<SoundClipDuplicateConflict | null> {
  const key = soundClipKey(label, answer);
  const bank = await readStoredSoundBank();
  if (
    bank.some(
      (clip) => clip.id !== excludeId && soundClipKey(clip.label, clip.answer) === key
    )
  ) {
    return { source: "bank", label: label.trim(), answer: answer.trim() };
  }

  const quizzes = await readAllLibraryQuizzes();
  for (const quiz of quizzes) {
    for (const question of quiz.questions ?? []) {
      const identity = soundIdentityFromQuestionFields({
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

export async function addStoredSoundBankItem(input: NewSoundBankItemInput): Promise<SoundBankItem> {
  const label = input.label.trim();
  const answer = input.answer.trim();
  const conflict = await findSoundClipConflict(label, answer);
  if (conflict) {
    throw new SoundClipDuplicateError(conflict);
  }

  const item = createSoundBankItem({ ...input, label, answer });
  const existing = await readStoredSoundBank();
  await writeStoredSoundBank([item, ...existing.filter((t) => t.id !== item.id)]);
  return item;
}

export async function updateStoredSoundBankItem(
  id: string,
  input: NewSoundBankItemInput
): Promise<SoundBankItem> {
  const label = input.label.trim();
  const answer = input.answer.trim();
  const audioUrl = input.audioUrl.trim();
  if (!label || !answer || !audioUrl) throw new Error("Vyplň popis, odpoveď a audio URL.");

  const existing = await readStoredSoundBank();
  const current = existing.find((c) => c.id === id);
  if (!current) throw new Error("NOT_FOUND");

  const conflict = await findSoundClipConflict(label, answer, id);
  if (conflict) throw new SoundClipDuplicateError(conflict);

  const updated: SoundBankItem = {
    ...current,
    label,
    answer,
    audioUrl,
    note: input.note?.trim() || undefined,
  };
  const next = existing.map((c) => (c.id === id ? updated : c));
  await writeStoredSoundBank(next);
  return updated;
}

export async function removeStoredSoundBankItem(id: string): Promise<boolean> {
  const existing = await readStoredSoundBank();
  const next = existing.filter((t) => t.id !== id);
  if (next.length === existing.length) return false;
  await writeStoredSoundBank(next);
  return true;
}
