import { migrateEventImagesToBlob } from "@/lib/media-migrate-events";
import { copyOrRewriteMediaUrl, mediaUrlNeedsRepair } from "@/lib/media-copy-to-blob";
import { hydrateQuizMediaForPlayback, summarizeQuizMedia } from "@/lib/quiz-media-resolve";
import type { QuizQuestionItem } from "@/lib/quiz-library";
import { readAllLibraryQuizzes, readLibraryQuiz, saveLibraryQuiz } from "@/lib/quiz-library-storage";
import { readStoredMusicBank, writeStoredMusicBank } from "@/lib/music-bank-storage";
import { readStoredSoundBank, writeStoredSoundBank } from "@/lib/sound-bank-storage";
import { readStoredVideoBank, writeStoredVideoBank } from "@/lib/video-bank-storage";
import { shouldWriteBlob } from "@/lib/storage";
async function repairOneQuiz(quizId: string) {
  const raw = await readLibraryQuiz(quizId);
  if (!raw) return { quizId, error: "Kvíz nenájdený" as const };

  const before = raw.questions.map((q) => ({ ...q }));
  let hydrated = await hydrateQuizMediaForPlayback(raw);

  const questions: QuizQuestionItem[] = [];
  for (const q of hydrated.questions) {
    questions.push({
      ...q,
      audioUrl: await copyOrRewriteMediaUrl(q.audioUrl),
      videoUrl: await copyOrRewriteMediaUrl(q.videoUrl),
      imageUrl: await copyOrRewriteMediaUrl(q.imageUrl),
    });
  }
  hydrated = { ...hydrated, questions };

  const changed =
    JSON.stringify(before.map((q) => ({ audioUrl: q.audioUrl, videoUrl: q.videoUrl, imageUrl: q.imageUrl }))) !==
    JSON.stringify(questions.map((q) => ({ audioUrl: q.audioUrl, videoUrl: q.videoUrl, imageUrl: q.imageUrl })));

  if (changed || before.some((q) => !q.audioUrl?.trim() && questions.find((p) => p.id === q.id)?.audioUrl)) {
    await saveLibraryQuiz(hydrated);
  }

  return {
    quizId,
    saved: true,
    changed,
    media: summarizeQuizMedia(hydrated, before),
  };
}

async function repairBanks() {
  let musicUpdated = 0;
  let soundUpdated = 0;
  let videoUpdated = 0;
  const failed: string[] = [];

  const music = await readStoredMusicBank();
  const nextMusic = structuredClone(music);
  for (const track of nextMusic) {
    if (!mediaUrlNeedsRepair(track.audioUrl)) continue;
    const next = await copyOrRewriteMediaUrl(track.audioUrl);
    if (next && next !== track.audioUrl) {
      track.audioUrl = next;
      musicUpdated++;
    } else if (mediaUrlNeedsRepair(track.audioUrl)) {
      failed.push(`Hudba: ${track.artist} — ${track.title}`);
    }
  }
  if (musicUpdated) await writeStoredMusicBank(nextMusic);

  const sound = await readStoredSoundBank();
  const nextSound = structuredClone(sound);
  for (const clip of nextSound) {
    if (!mediaUrlNeedsRepair(clip.audioUrl)) continue;
    const next = await copyOrRewriteMediaUrl(clip.audioUrl);
    if (next && next !== clip.audioUrl) {
      clip.audioUrl = next;
      soundUpdated++;
    } else if (mediaUrlNeedsRepair(clip.audioUrl)) {
      failed.push(`Zvuk: ${clip.label}`);
    }
  }
  if (soundUpdated) await writeStoredSoundBank(nextSound);

  const video = await readStoredVideoBank();
  const nextVideo = structuredClone(video);
  for (const clip of nextVideo) {
    if (!mediaUrlNeedsRepair(clip.videoUrl)) continue;
    const next = await copyOrRewriteMediaUrl(clip.videoUrl);
    if (next && next !== clip.videoUrl) {
      clip.videoUrl = next;
      videoUpdated++;
    } else if (mediaUrlNeedsRepair(clip.videoUrl)) {
      failed.push(`Video: ${clip.label}`);
    }
  }
  if (videoUpdated) await writeStoredVideoBank(nextVideo);

  return { musicUpdated, soundUpdated, videoUpdated, failed };
}

export async function runFullMediaRepair() {
  if (!shouldWriteBlob()) {
    return {
      ok: false,
      error: "Blob nie je nakonfigurovaný vo Verceli (BLOB_STORE_ID / token).",
    };
  }

  const eventImages = await migrateEventImagesToBlob();

  const quizzes = await readAllLibraryQuizzes();
  const quizResults = [];
  for (const q of quizzes) {
    quizResults.push(await repairOneQuiz(q.id));
  }

  const banks = await repairBanks();

  const quizzesChanged = quizResults.filter((r) => "changed" in r && r.changed).length;
  const allFailed = [
    ...(eventImages.failed ?? []).map((f) => `Fotka ${f.slug}: ${f.reason}`),
    ...banks.failed,
  ];

  return {
    ok: allFailed.length === 0,
    eventImages,
    quizCount: quizzes.length,
    quizzesChanged,
    quizResults,
    banks,
    failed: allFailed.slice(0, 50),
    hint:
      allFailed.length === 0
        ? "Hotovo — obnov stránky (Ctrl+F5). Ukážky a fotky by mali ísť z Blob."
        : "Čo ostalo v „failed“, už nie je v úložisku — pri tej otázke znova nahraj MP3 alebo fotku v editore.",
  };
}
