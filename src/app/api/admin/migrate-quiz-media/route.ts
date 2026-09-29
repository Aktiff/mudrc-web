import { NextResponse } from "next/server";
import { uploadBlobMedia } from "@/lib/blob-media";
import { isSupabaseUploadsUrl, supabaseUploadsObjectPath } from "@/lib/media-url";
import { readStoredMusicBank, writeStoredMusicBank } from "@/lib/music-bank-storage";
import { readAllLibraryQuizzes, saveLibraryQuiz } from "@/lib/quiz-library-storage";
import { readStoredSoundBank, writeStoredSoundBank } from "@/lib/sound-bank-storage";
import { shouldWriteBlob } from "@/lib/storage";
import { fetchSupabaseUploadsBytes } from "@/lib/supabase-uploads-bytes";
import { readStoredVideoBank, writeStoredVideoBank } from "@/lib/video-bank-storage";
import type { QuizLibraryItem } from "@/lib/quiz-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mediaFolder(objectPath: string): "audio" | "video" | "images" {
  if (objectPath.startsWith("video/")) return "video";
  if (objectPath.startsWith("audio/")) return "audio";
  return "images";
}

async function migrateMediaUrl(url: string): Promise<{ next: string; migrated: boolean; error?: string }> {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("/api/media/")) {
    return { next: trimmed, migrated: false };
  }
  if (!isSupabaseUploadsUrl(trimmed)) {
    return { next: trimmed, migrated: false };
  }

  const objectPath = supabaseUploadsObjectPath(trimmed);
  if (!objectPath) {
    return { next: trimmed, migrated: false, error: "Neplatná Supabase URL" };
  }

  const file = await fetchSupabaseUploadsBytes(objectPath);
  if (!file?.buffer.length) {
    return {
      next: trimmed,
      migrated: false,
      error: "Súbor sa nepodarilo stiahnuť zo Supabase (402?) — skús proxy po deployi alebo nahraj znova.",
    };
  }

  const fileName = objectPath.split("/").pop() ?? `clip-${Date.now()}.bin`;
  try {
    const folder = mediaFolder(objectPath);
    const { url: blobUrl } = await uploadBlobMedia(folder, fileName, file.buffer, file.contentType);
    return { next: blobUrl, migrated: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { next: trimmed, migrated: false, error: message };
  }
}

async function migrateQuiz(quiz: QuizLibraryItem) {
  let changed = false;
  const failed: string[] = [];
  for (const question of quiz.questions) {
    if (question.audioUrl?.trim()) {
      const r = await migrateMediaUrl(question.audioUrl);
      if (r.migrated) {
        question.audioUrl = r.next;
        changed = true;
      } else if (r.error) failed.push(`${quiz.id} audio: ${r.error}`);
    }
    if (question.videoUrl?.trim()) {
      const r = await migrateMediaUrl(question.videoUrl);
      if (r.migrated) {
        question.videoUrl = r.next;
        changed = true;
      } else if (r.error) failed.push(`${quiz.id} video: ${r.error}`);
    }
    if (question.imageUrl?.trim() && isSupabaseUploadsUrl(question.imageUrl)) {
      const r = await migrateMediaUrl(question.imageUrl);
      if (r.migrated) {
        question.imageUrl = r.next;
        changed = true;
      } else if (r.error) failed.push(`${quiz.id} image: ${r.error}`);
    }
  }
  if (changed) {
    await saveLibraryQuiz(quiz);
  }
  return { quizId: quiz.id, changed, failed };
}

export async function POST() {
  if (!shouldWriteBlob()) {
    return NextResponse.json({ ok: false, error: "Blob nie je nakonfigurovaný." }, { status: 503 });
  }

  const quizResults: { quizId: string; changed: boolean; failed: string[] }[] = [];
  const quizzes = await readAllLibraryQuizzes();
  for (const quiz of quizzes) {
    const { quizId, changed, failed } = await migrateQuiz(structuredClone(quiz));
    quizResults.push({ quizId, changed, failed });
  }

  let musicChanged = 0;
  const musicFailed: string[] = [];
  const musicBank = await readStoredMusicBank();
  const nextMusic = structuredClone(musicBank);
  for (const track of nextMusic) {
    if (!track.audioUrl?.trim()) continue;
    const r = await migrateMediaUrl(track.audioUrl);
    if (r.migrated) {
      track.audioUrl = r.next;
      musicChanged++;
    } else if (r.error) musicFailed.push(`${track.title}: ${r.error}`);
  }
  if (musicChanged) await writeStoredMusicBank(nextMusic);

  let soundChanged = 0;
  const soundFailed: string[] = [];
  const soundBank = await readStoredSoundBank();
  const nextSound = structuredClone(soundBank);
  for (const clip of nextSound) {
    if (!clip.audioUrl?.trim()) continue;
    const r = await migrateMediaUrl(clip.audioUrl);
    if (r.migrated) {
      clip.audioUrl = r.next;
      soundChanged++;
    } else if (r.error) soundFailed.push(`${clip.label}: ${r.error}`);
  }
  if (soundChanged) await writeStoredSoundBank(nextSound);

  let videoChanged = 0;
  const videoFailed: string[] = [];
  const videoBank = await readStoredVideoBank();
  const nextVideo = structuredClone(videoBank);
  for (const clip of nextVideo) {
    if (!clip.videoUrl?.trim()) continue;
    const r = await migrateMediaUrl(clip.videoUrl);
    if (r.migrated) {
      clip.videoUrl = r.next;
      videoChanged++;
    } else if (r.error) videoFailed.push(`${clip.label}: ${r.error}`);
  }
  if (videoChanged) await writeStoredVideoBank(nextVideo);

  const quizzesMigrated = quizResults.filter((r) => r.changed).length;
  const allFailed = [
    ...quizResults.flatMap((r) => r.failed),
    ...musicFailed,
    ...soundFailed,
    ...videoFailed,
  ];

  return NextResponse.json(
    {
      ok: allFailed.length === 0,
      quizzesMigrated,
      quizResults,
      musicTracksMigrated: musicChanged,
      soundClipsMigrated: soundChanged,
      videoClipsMigrated: videoChanged,
      failed: allFailed.slice(0, 40),
      hint:
        allFailed.length > 0
          ? "Ak migrácia zlyhá, po deployi by mala fungovať proxy /api/media/supabase/… — obnov Prehrať kvíz."
          : "Media URL sú v Blob — ukážky by mali hrať aj bez Supabase.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
