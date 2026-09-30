import fs from "fs";
import path from "path";
import type { QuizLibraryItem } from "@/lib/quiz-library";
import { normalizeLibraryQuiz } from "@/lib/quiz-library";
import { readAppStorageBlob, writeAppStorageBlob } from "@/lib/blob-app-storage";
import { shouldWriteBlob } from "@/lib/storage";

const quizBackupBlobName = (id: string) => `quiz-library-backup-${id}`;

function localBackupPath(id: string): string {
  return path.join(process.cwd(), `src/data/quiz-library-${id}.backup.json`);
}

export async function writeQuizLibraryBackup(quiz: QuizLibraryItem): Promise<void> {
  const payload = { quiz, savedAt: new Date().toISOString() };
  if (shouldWriteBlob()) {
    await writeAppStorageBlob(quizBackupBlobName(quiz.id), payload);
    return;
  }
  fs.mkdirSync(path.dirname(localBackupPath(quiz.id)), { recursive: true });
  fs.writeFileSync(localBackupPath(quiz.id), JSON.stringify(payload, null, 2), "utf-8");
}

export async function readQuizLibraryBackup(id: string): Promise<QuizLibraryItem | null> {
  try {
    const fromBlob = await readAppStorageBlob<{ quiz: QuizLibraryItem }>(quizBackupBlobName(id));
    if (fromBlob?.quiz) return normalizeLibraryQuiz(fromBlob.quiz);

    const filePath = localBackupPath(id);
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { quiz: QuizLibraryItem };
    return raw.quiz ? normalizeLibraryQuiz(raw.quiz) : null;
  } catch {
    return null;
  }
}
