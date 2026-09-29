import { uploadBlobMedia } from "@/lib/blob-media";
import { isSupabaseUploadsUrl, rewriteStoredMediaUrl } from "@/lib/media-url";
import {
  hydrateQuizMediaForPlayback,
  summarizeQuizMedia,
} from "@/lib/quiz-media-resolve";
import { readAllLibraryQuizzes, readLibraryQuiz, saveLibraryQuiz } from "@/lib/quiz-library-storage";
import { readStoredMusicBank, writeStoredMusicBank } from "@/lib/music-bank-storage";
import { readStoredSoundBank, writeStoredSoundBank } from "@/lib/sound-bank-storage";
import { shouldWriteBlob } from "@/lib/storage";
import { fetchSupabaseUploadsBytes } from "@/lib/supabase-uploads-bytes";

async function maybeCopyToBlob(url: string): Promise<string> {
  const rewritten = rewriteStoredMediaUrl(url) ?? url;
  if (!rewritten.startsWith("/api/media/supabase/")) return rewritten;
  if (!shouldWriteBlob()) return rewritten;

  const objectPath = rewritten
    .replace(/^\/api\/media\/supabase\//, "")
    .split("/")
    .map((p) => decodeURIComponent(p))
    .join("/");
  const file = await fetchSupabaseUploadsBytes(objectPath);
  if (!file?.buffer.length) return rewritten;

  const fileName = objectPath.split("/").pop() ?? "clip.mp3";
  const folder = objectPath.startsWith("video/") ? "video" : objectPath.startsWith("events/") ? "events" : "audio";
  const { url: blobUrl } = await uploadBlobMedia(folder, fileName, file.buffer, file.contentType);
  return blobUrl;
}

async function repairQuizId(quizId: string, copyToBlob: boolean) {
  const raw = await readLibraryQuiz(quizId);
  if (!raw) return { quizId, error: "Kvíz nenájdený" as const };

  const before = raw.questions.map((q) => ({ ...q }));
  let hydrated = await hydrateQuizMediaForPlayback(raw);

  if (copyToBlob) {
    const questions = [];
    for (const q of hydrated.questions) {
      let audioUrl = q.audioUrl;
      let videoUrl = q.videoUrl;
      let imageUrl = q.imageUrl;
      const orig = before.find((p) => p.id === q.id);
      const origAudio = orig?.audioUrl?.trim();
      if (
        audioUrl &&
        ((origAudio && isSupabaseUploadsUrl(origAudio)) || audioUrl.includes("/api/media/supabase/"))
      ) {
        audioUrl = await maybeCopyToBlob(origAudio || audioUrl);
      }
      if (videoUrl && (videoUrl.includes("/api/media/supabase/") || isSupabaseUploadsUrl(orig?.videoUrl ?? ""))) {
        videoUrl = await maybeCopyToBlob(orig?.videoUrl?.trim() || videoUrl);
      }
      if (imageUrl && (imageUrl.includes("/api/media/supabase/") || isSupabaseUploadsUrl(orig?.imageUrl ?? ""))) {
        imageUrl = await maybeCopyToBlob(orig?.imageUrl?.trim() || imageUrl);
      }
      questions.push({ ...q, audioUrl, videoUrl, imageUrl });
    }
    hydrated = { ...hydrated, questions };
    await saveLibraryQuiz(hydrated);
  }

  return {
    quizId,
    saved: copyToBlob,
    media: summarizeQuizMedia(hydrated, before),
  };
}

export async function runRepairQuizMedia(options: {
  quizId?: string;
  copyToBlob?: boolean;
  probeOnly?: boolean;
}) {
  const copyToBlob = options.copyToBlob === true && options.probeOnly !== true;

  if (options.quizId?.trim()) {
    const result = await repairQuizId(options.quizId.trim(), copyToBlob);
    return { ok: true, results: [result] };
  }

  const quizzes = await readAllLibraryQuizzes();
  const results = [];
  for (const q of quizzes) {
    results.push(await repairQuizId(q.id, copyToBlob));
  }

  let bankAudioRewritten = 0;
  if (copyToBlob && shouldWriteBlob()) {
    const music = await readStoredMusicBank();
    const nextMusic = structuredClone(music);
    for (const track of nextMusic) {
      if (!track.audioUrl?.trim()) continue;
      if (!isSupabaseUploadsUrl(track.audioUrl) && !track.audioUrl.includes("/api/media/supabase/")) continue;
      const next = await maybeCopyToBlob(track.audioUrl);
      if (next !== track.audioUrl) {
        track.audioUrl = next;
        bankAudioRewritten++;
      }
    }
    if (bankAudioRewritten) await writeStoredMusicBank(nextMusic);

    const sound = await readStoredSoundBank();
    const nextSound = structuredClone(sound);
    let soundChanged = 0;
    for (const clip of nextSound) {
      if (!clip.audioUrl?.trim()) continue;
      if (!isSupabaseUploadsUrl(clip.audioUrl) && !clip.audioUrl.includes("/api/media/supabase/")) continue;
      const next = await maybeCopyToBlob(clip.audioUrl);
      if (next !== clip.audioUrl) {
        clip.audioUrl = next;
        soundChanged++;
      }
    }
    if (soundChanged) await writeStoredSoundBank(nextSound);
  }

  return {
    ok: true,
    quizCount: quizzes.length,
    results,
    bankAudioRewritten,
  };
}
