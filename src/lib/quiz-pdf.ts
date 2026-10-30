import { resolveMediaSrc } from "@/lib/media-url";
import { isQuestionSlotEmpty, type QuizQuestionItem } from "@/lib/quiz-library";
import {
  findCorrectOptionIndex,
  getQuestionBodyText,
  matchPairsFromQuiz,
  optionLetter,
  orderItemsFromAnswer,
  parseEmbeddedOptions,
} from "@/lib/quiz-question-options";
import { displayQuestionNumber, sortQuizQuestions } from "@/lib/quiz-template";
import { buildImagePdf } from "@/lib/pdf-images";
import { DEFAULT_MUSIC_QUESTION_BODY } from "@/lib/music-bank";
import { DEFAULT_SOUND_QUESTION_BODY } from "@/lib/sound-bank";
import { DEFAULT_VIDEO_QUESTION_BODY } from "@/lib/video-bank";

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const MARGIN = 72;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Sheet = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  y: number;
};

function createSheet(): Sheet {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Prehliadač nevie pripraviť PDF.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return { canvas, context, y: MARGIN };
}

function breakWideWord(context: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const char of word) {
    const trial = current + char;
    if (context.measureText(trial).width <= maxWidth) current = trial;
    else {
      if (current) pieces.push(current);
      current = char;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const pieces = context.measureText(word).width > maxWidth ? breakWideWord(context, word, maxWidth) : [word];
      for (const piece of pieces) {
        const trial = current ? `${current} ${piece}` : piece;
        if (context.measureText(trial).width <= maxWidth) current = trial;
        else {
          if (current) lines.push(current);
          current = piece;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function ensureSpace(pages: Sheet[], height: number): Sheet {
  const current = pages[pages.length - 1];
  if (current.y + height <= PAGE_HEIGHT - MARGIN) return current;
  const next = createSheet();
  pages.push(next);
  return next;
}

function drawLines(
  pages: Sheet[],
  text: string,
  font: string,
  color: string,
  size: number,
  gapAfter = 8
): void {
  const measure = pages[pages.length - 1].context;
  measure.font = font;
  const lines = wrapText(measure, text, CONTENT_WIDTH);
  const lineHeight = Math.round(size * 1.35);
  for (const line of lines) {
    const page = ensureSpace(pages, lineHeight);
    page.context.font = font;
    page.context.fillStyle = color;
    page.context.fillText(line, MARGIN, page.y + size);
    page.y += lineHeight;
  }
  pages[pages.length - 1].y += gapAfter;
}

function questionBody(question: QuizQuestionItem): string {
  const body = getQuestionBodyText(question).trim();
  if (question.kind === "music" && (!body || body === DEFAULT_MUSIC_QUESTION_BODY)) return "Hudobná ukážka";
  if (question.kind === "sound" && (!body || body === DEFAULT_SOUND_QUESTION_BODY)) return "Zvuková ukážka";
  if (question.kind === "video" && (!body || body === DEFAULT_VIDEO_QUESTION_BODY)) return "Video ukážka";
  return body || "Otázka";
}

function choiceLines(question: QuizQuestionItem): string[] {
  const stored = (question.options ?? []).map((option) => option.trim()).filter(Boolean);
  const choices = stored.length ? stored : parseEmbeddedOptions(question.body).options;
  if (!choices.length || question.isOrderQuestion || question.isMatchQuestion) return [];
  const correct = findCorrectOptionIndex(choices, question.answer);
  return choices.map((choice, index) => {
    const mark = index === correct ? "  ← správne" : "";
    return `${optionLetter(index)}) ${choice}${mark}`;
  });
}

function answerText(question: QuizQuestionItem): string {
  if (question.kind === "music") {
    const artist = question.musicArtist?.trim();
    const title = question.musicTitle?.trim();
    if (artist && title) return `${artist} — ${title}`;
  }
  if (question.isOrderQuestion) {
    const items = orderItemsFromAnswer(question.answer);
    if (items.length) return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
  }
  if (question.isMatchQuestion) {
    const pairs = matchPairsFromQuiz(question.options ?? [], question.matchRight ?? [], question.answer);
    if (pairs.length) return pairs.map((pair) => `${pair.left} — ${pair.right}`).join("\n");
  }
  return question.answer.trim();
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const src = resolveMediaSrc(url);
  if (!src) return null;
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(null), 8000);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    if (/^https?:/i.test(src)) image.crossOrigin = "anonymous";
    image.src = src;
  });
}

async function drawImage(pages: Sheet[], url: string): Promise<void> {
  const image = await loadImage(url);
  if (!image || !image.naturalWidth) return;
  const width = CONTENT_WIDTH;
  const height = Math.min(420, Math.round(width * (image.naturalHeight / image.naturalWidth)));
  const page = ensureSpace(pages, height + 16);
  page.context.drawImage(image, MARGIN, page.y, width, height);
  page.y += height + 16;
}

function drawQuestion(pages: Sheet[], question: QuizQuestionItem, image: HTMLImageElement | null): void {
  const page = ensureSpace(pages, 36);
  page.context.strokeStyle = "#e5e5e5";
  page.context.beginPath();
  page.context.moveTo(MARGIN, page.y);
  page.context.lineTo(PAGE_WIDTH - MARGIN, page.y);
  page.context.stroke();
  page.y += 18;

  drawLines(
    pages,
    `Kolo ${question.roundNumber} · ${displayQuestionNumber(question)}.`,
    "700 28px Arial, sans-serif",
    "#111111",
    28,
    6
  );
  drawLines(pages, questionBody(question), "400 32px Arial, sans-serif", "#111111", 32, 10);

  const choices = choiceLines(question);
  for (const line of choices) {
    drawLines(pages, line, "400 26px Arial, sans-serif", "#222222", 26, 2);
  }
  if (choices.length) pages[pages.length - 1].y += 8;

  const answer = answerText(question);
  drawLines(pages, "Správna odpoveď:", "700 26px Arial, sans-serif", "#111111", 26, 4);
  drawLines(
    pages,
    answer || "bez odpovede",
    "400 26px Arial, sans-serif",
    answer ? "#111111" : "#777777",
    26,
    6
  );
  const note = question.hostNote?.trim();
  if (note) drawLines(pages, `Pre teba: ${note}`, "400 22px Arial, sans-serif", "#555555", 22, 8);

  if (image?.naturalWidth) {
    const width = Math.min(CONTENT_WIDTH, 640);
    const height = Math.min(360, Math.round(width * (image.naturalHeight / image.naturalWidth)));
    const target = ensureSpace(pages, height + 12);
    target.context.drawImage(image, MARGIN, target.y, width, height);
    target.y += height + 12;
  }
  pages[pages.length - 1].y += 12;
}

async function canvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("PDF sa nepodarilo zložiť.");
  return new Uint8Array(await blob.arrayBuffer());
}

export async function downloadQuizPdf(title: string, questions: QuizQuestionItem[]): Promise<void> {
  const filled = sortQuizQuestions(questions).filter((question) => !isQuestionSlotEmpty(question));
  if (!filled.length) throw new Error("V kvíze zatiaľ nie sú vyplnené otázky.");

  const loadedImages = new Map<string, HTMLImageElement>();
  await Promise.all(
    filled.map(async (question) => {
      const url = question.imageUrl?.trim();
      if (!url) return;
      const image = await loadImage(url);
      if (image) loadedImages.set(question.id, image);
    })
  );

  const pages: Sheet[] = [createSheet()];
  drawLines(pages, title.trim() || "Kvíz", "700 42px Arial, sans-serif", "#111111", 42, 8);
  drawLines(
    pages,
    "Otázky sú v tomto PDF ako obrázok. Text sa nedá označiť ani skopírovať.",
    "400 22px Arial, sans-serif",
    "#666666",
    22,
    28
  );

  for (const question of filled) {
    drawQuestion(pages, question, loadedImages.get(question.id) ?? null);
  }

  pages.forEach((page, index) => {
    page.context.font = "400 20px Arial, sans-serif";
    page.context.fillStyle = "#888888";
    page.context.fillText(`${index + 1} / ${pages.length}`, PAGE_WIDTH - MARGIN - 80, PAGE_HEIGHT - 36);
  });

  const jpegs = await Promise.all(pages.map((page) => canvasJpeg(page.canvas)));
  const pdf = buildImagePdf(jpegs.map((jpeg) => ({ jpeg, width: PAGE_WIDTH, height: PAGE_HEIGHT })));
  const blob = new Blob([pdf.slice().buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeTitle = title.trim().replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").slice(0, 80) || "Kviz";
  link.href = url;
  link.download = `${safeTitle}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
