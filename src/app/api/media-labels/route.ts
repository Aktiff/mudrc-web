import crypto from "crypto";
import { NextResponse } from "next/server";
import { readStoredMusicBank } from "@/lib/music-bank-storage";
import { readAllLibraryQuizzes } from "@/lib/quiz-library-storage";
import { readStoredSoundBank } from "@/lib/sound-bank-storage";
import { readStoredVideoBank } from "@/lib/video-bank-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function authorized(token: string, secret: string): boolean {
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return false;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
      purpose?: unknown;
    };
    if (json.purpose !== "labels") return false;
    return typeof json.exp === "number" && json.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function mediaPath(url: string | undefined): string | null {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname !== "media.mudrc.sk") return null;
    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
    if (!path.startsWith("audio/") && !path.startsWith("video/")) return null;
    return path;
  } catch {
    return null;
  }
}

function put(names: Record<string, string>, url: string | undefined, label: string) {
  const path = mediaPath(url);
  const name = label.replace(/[\r\n\0]/g, " ").trim().slice(0, 180);
  if (!path || !name) return;
  names[path] = name;
}

export async function POST(req: Request) {
  const secret = process.env.MEDIA_UPLOAD_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Chýba MEDIA_UPLOAD_SECRET." }, { status: 503 });
  }
  const token = (await req.text()).trim();
  if (!authorized(token, secret)) {
    return NextResponse.json({ error: "Neplatný token." }, { status: 403 });
  }

  const names: Record<string, string> = {};

  try {
    const quizzes = await readAllLibraryQuizzes();
    for (const quiz of quizzes) {
      for (const question of quiz.questions) {
        const artist = question.musicArtist?.trim() ?? "";
        const title = question.musicTitle?.trim() ?? "";
        const mediaLabel = question.mediaLabel?.trim() ?? "";
        if (artist && title) {
          put(names, question.audioUrl, `${artist} — ${title}`);
        } else if (mediaLabel) {
          put(names, question.audioUrl, mediaLabel);
        }
        if (mediaLabel) put(names, question.videoUrl, mediaLabel);
      }
    }
  } catch {
    /* banka nižšie doplní, čo sa dá */
  }

  try {
    const clips = await readStoredSoundBank();
    for (const clip of clips) put(names, clip.audioUrl, clip.label);
  } catch {
    /* preskoč */
  }

  try {
    const clips = await readStoredVideoBank();
    for (const clip of clips) put(names, clip.videoUrl, clip.label);
  } catch {
    /* preskoč */
  }

  try {
    const tracks = await readStoredMusicBank();
    for (const track of tracks) put(names, track.audioUrl, `${track.artist} — ${track.title}`);
  } catch {
    /* preskoč */
  }

  return NextResponse.json({ names });
}
