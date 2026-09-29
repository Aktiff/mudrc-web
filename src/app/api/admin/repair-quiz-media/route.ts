import { NextRequest, NextResponse } from "next/server";
import { uploadBlobMedia } from "@/lib/blob-media";
import { isSupabaseUploadsUrl } from "@/lib/media-url";
import {
  hydrateQuizMediaForPlayback,
  rewriteStoredMediaUrl,
  summarizeQuizMedia,
} from "@/lib/quiz-media-resolve";
import { readAllLibraryQuizzes, readLibraryQuiz, saveLibraryQuiz } from "@/lib/quiz-library-storage";
import { readStoredMusicBank, writeStoredMusicBank } from "@/lib/music-bank-storage";
import { readStoredSoundBank, writeStoredSoundBank } from "@/lib/sound-bank-storage";
import { shouldWriteBlob } from "@/lib/storage";
import { fetchSupabaseUploadsBytes } from "@/lib/supabase-uploads-bytes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function maybeCopyToBlob(url: string): Promise<string> {
  const rewritten = rewriteStoredMediaUrl(url) ?? url;
  if (!rewritten.startsWith("/api/media/supabase/")) return rewritten;
  if (!shouldWriteBlob()) return rewritten;

  const objectPath = rewritten.replace(/^\/api\/media\/supabase\//, "")
    .split("/")
    .map((p) => decodeURIComponent(p))
    .join("/");
  const file = await fetchSupabaseUploadsBytes(objectPath);
  if (!file?.buffer.length) return rewritten;

  const fileName = objectPath.split("/").pop() ?? "clip.mp3";
  const folder = objectPath.startsWith("video/") ? "video" : "audio";
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
      const origAudio = before.find((p) => p.id === q.id)?.audioUrl?.trim();
      if (
        audioUrl &&
        (origAudio && isSupabaseUploadsUrl(origAudio) || audioUrl.includes("/api/media/supabase/"))
      ) {
        audioUrl = await maybeCopyToBlob(origAudio || audioUrl);
      }
      if (videoUrl && videoUrl.includes("/api/media/supabase/")) {
        videoUrl = await maybeCopyToBlob(videoUrl);
      }
      questions.push({ ...q, audioUrl, videoUrl });
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

export async function POST(req: NextRequest) {
  let body: { quizId?: string; copyToBlob?: boolean; probeOnly?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const copyToBlob = body.copyToBlob === true;
  const probeOnly = body.probeOnly === true;

  if (body.quizId?.trim()) {
    const result = await repairQuizId(body.quizId.trim(), copyToBlob && !probeOnly);
    return NextResponse.json({ ok: true, results: [result] }, { headers: { "Cache-Control": "no-store" } });
  }

  const quizzes = await readAllLibraryQuizzes();
  const results = [];
  for (const q of quizzes) {
    results.push(await repairQuizId(q.id, copyToBlob && !probeOnly));
  }

  let bankAudioRewritten = 0;
  if (copyToBlob && !probeOnly && shouldWriteBlob()) {
    const music = await readStoredMusicBank();
    const nextMusic = structuredClone(music);
    for (const track of nextMusic) {
      if (!track.audioUrl?.trim() || !isSupabaseUploadsUrl(track.audioUrl)) continue;
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
      if (!clip.audioUrl?.trim() || !isSupabaseUploadsUrl(clip.audioUrl)) continue;
      const next = await maybeCopyToBlob(clip.audioUrl);
      if (next !== clip.audioUrl) {
        clip.audioUrl = next;
        soundChanged++;
      }
    }
    if (soundChanged) await writeStoredSoundBank(nextSound);
  }

  return NextResponse.json(
    {
      ok: true,
      quizCount: quizzes.length,
      results,
      bankAudioRewritten,
      hint: "Obnov Prehrať kvíz (Ctrl+F5). Ak playbackSrc je prázdne, v editore znova Nahraj MP3 (~30 s).",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
