import fs from "fs";
import path from "path";
import type { QuizLibraryItem } from "@/lib/quiz-library";
import { normalizeLibraryQuiz } from "@/lib/quiz-library";
import {
  hasSupabaseStorage,
  supabaseFetchQuizLibraryBackup,
  supabaseSetQuizLibraryBackup,
} from "@/lib/supabase-storage";

function localBackupPath(id: string): string {
  return path.join(process.cwd(), `src/data/quiz-library-${id}.backup.json`);
}

export async function writeQuizLibraryBackup(quiz: QuizLibraryItem): Promise<void> {
  const payload = { quiz, savedAt: new Date().toISOString() };
  if (hasSupabaseStorage()) {
    await supabaseSetQuizLibraryBackup(quiz.id, payload);
    return;
  }
  fs.mkdirSync(path.dirname(localBackupPath(quiz.id)), { recursive: true });
  fs.writeFileSync(localBackupPath(quiz.id), JSON.stringify(payload, null, 2), "utf-8");
}

export async function readQuizLibraryBackup(id: string): Promise<QuizLibraryItem | null> {
  try {
    if (hasSupabaseStorage()) {
      const result = await supabaseFetchQuizLibraryBackup(id);
      if (result.status !== "ok") return null;
      return normalizeLibraryQuiz(result.value.quiz as QuizLibraryItem);
    }
    const filePath = localBackupPath(id);
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { quiz: QuizLibraryItem };
    return raw.quiz ? normalizeLibraryQuiz(raw.quiz) : null;
  } catch {
    return null;
  }
}
