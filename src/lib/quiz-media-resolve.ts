import { isMusicBankId, musicTrackKey, type MusicBankItem } from "@/lib/music-bank";
import { isSoundBankId, type SoundBankItem } from "@/lib/sound-bank";
import { rewriteStoredMediaUrl } from "@/lib/media-url";
import type { QuizLibraryItem, QuizQuestionItem } from "@/lib/quiz-library";
import { readStoredMusicBank } from "@/lib/music-bank-storage";
import { readStoredSoundBank } from "@/lib/sound-bank-storage";

function pickBankAudio(
  question: QuizQuestionItem,
  musicById: Map<string, MusicBankItem>,
  soundById: Map<string, SoundBankItem>,
  musicByKey: Map<string, MusicBankItem>
): string | undefined {
  const bankId = question.bankQuestionId?.trim();
  if (bankId) {
    if (isMusicBankId(bankId)) {
      const track = musicById.get(bankId);
      if (track?.audioUrl?.trim()) return track.audioUrl.trim();
    }
    if (isSoundBankId(bankId)) {
      const clip = soundById.get(bankId);
      if (clip?.audioUrl?.trim()) return clip.audioUrl.trim();
    }
  }

  const artist = question.musicArtist?.trim();
  const title = question.musicTitle?.trim();
  if (artist && title) {
    const track = musicByKey.get(musicTrackKey(artist, title));
    if (track?.audioUrl?.trim()) return track.audioUrl.trim();
  }

  return undefined;
}

/** Doplní chýbajúce audioUrl z banky a prepíše Supabase URL na proxy. */
export async function hydrateQuizMediaForPlayback(quiz: QuizLibraryItem): Promise<QuizLibraryItem> {
  const [musicBank, soundBank] = await Promise.all([readStoredMusicBank(), readStoredSoundBank()]);
  const musicById = new Map(musicBank.map((t) => [t.id, t]));
  const soundById = new Map(soundBank.map((c) => [c.id, c]));
  const musicByKey = new Map(musicBank.map((t) => [musicTrackKey(t.artist, t.title), t]));

  const questions = quiz.questions.map((q) => {
    let audioUrl = q.audioUrl?.trim();
    if (!audioUrl) {
      audioUrl = pickBankAudio(q, musicById, soundById, musicByKey);
    }
    return {
      ...q,
      audioUrl: rewriteStoredMediaUrl(audioUrl),
      videoUrl: rewriteStoredMediaUrl(q.videoUrl),
      imageUrl: rewriteStoredMediaUrl(q.imageUrl),
    };
  });

  return { ...quiz, questions };
}

export type MediaProbeRow = {
  questionId: string;
  kind: string;
  round: number;
  number: number;
  storedAudioUrl?: string;
  playbackSrc?: string;
  bankQuestionId?: string;
  hydratedFromBank: boolean;
};

export function summarizeQuizMedia(quiz: QuizLibraryItem, before: QuizQuestionItem[]): MediaProbeRow[] {
  return quiz.questions
    .filter((q) => q.kind === "music" || q.kind === "sound")
    .map((q) => {
      const prev = before.find((p) => p.id === q.id);
      const hadAudio = Boolean(prev?.audioUrl?.trim());
      return {
        questionId: q.id,
        kind: q.kind,
        round: q.roundNumber,
        number: q.questionNumber,
        storedAudioUrl: prev?.audioUrl?.trim() || undefined,
        playbackSrc: q.audioUrl,
        bankQuestionId: q.bankQuestionId,
        hydratedFromBank: !hadAudio && Boolean(q.audioUrl?.trim()),
      };
    });
}
