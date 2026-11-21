import { zipSync, strToU8 } from "fflate";
import type { QuizEvent } from "@/lib/data";
import type { QuizLibraryItem, QuizQuestionItem, QuizPromoSlide } from "@/lib/quiz-library";
import {
  collectQuizMediaUrls,
  safeMediaFileName,
} from "@/lib/offline-presentation/collect-media";
import { resolveMediaBytes } from "@/lib/offline-presentation/resolve-media-bytes";
import { buildOfflinePlayerHtml } from "@/lib/offline-presentation/player-html";
import { bestPresentationImageUrl } from "@/lib/quiz-presentation";
import { resolveMediaSrc } from "@/lib/media-url";

export type OfflinePackageResult =
  | { ok: true; zip: Uint8Array; fileName: string; mediaCount: number; warnings: string[] }
  | { ok: false; error: string; failedUrls?: string[] };

type SlimEvent = {
  slug: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  quizType?: string;
  weeklyQuiz?: boolean;
  active?: boolean;
  thematic?: boolean;
  rules?: QuizEvent["rules"];
  specialRules?: QuizEvent["specialRules"];
  futureQuizzes?: QuizEvent["futureQuizzes"];
};

function slimEvents(events: QuizEvent[]): SlimEvent[] {
  return events
    .filter((event) => event.active !== false)
    .map((event) => ({
      slug: event.slug,
      venue: event.venue,
      city: event.city,
      date: event.date,
      time: event.time,
      quizType: event.quizType,
      weeklyQuiz: event.weeklyQuiz,
      active: event.active,
      thematic: event.thematic,
      rules: event.rules,
      specialRules: event.specialRules,
      futureQuizzes: event.futureQuizzes,
    }));
}

function rewriteUrl(url: string | undefined, map: Map<string, string>): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  const resolved = resolveMediaSrc(bestPresentationImageUrl(trimmed)) ?? bestPresentationImageUrl(trimmed);
  return map.get(resolved) ?? map.get(trimmed) ?? trimmed;
}

function rewriteQuestion(question: QuizQuestionItem, map: Map<string, string>): QuizQuestionItem {
  return {
    ...question,
    imageUrl: rewriteUrl(question.imageUrl, map),
    audioUrl: rewriteUrl(question.audioUrl, map),
    videoUrl: rewriteUrl(question.videoUrl, map),
  };
}

function rewritePromo(promo: QuizPromoSlide, map: Map<string, string>): QuizPromoSlide {
  return {
    ...promo,
    imageUrl: rewriteUrl(promo.imageUrl, map),
  };
}

function rewriteQuiz(quiz: QuizLibraryItem, map: Map<string, string>): QuizLibraryItem {
  return {
    ...quiz,
    questions: quiz.questions.map((q) => rewriteQuestion(q, map)),
    promos: quiz.promos?.map((p) => rewritePromo(p, map)),
  };
}

function safeZipBaseName(title: string, id: string): string {
  const cleaned = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || `kviz-${id}`;
}

/** Latin + latin-ext subsets so Slovak diacritics work offline. */
const FONT_SOURCES: { path: string; url: string }[] = [
  {
    path: "fonts/bebas-neue-latin.woff2",
    url: "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2",
  },
  {
    path: "fonts/bebas-neue-latin-ext.woff2",
    url: "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXoo9Wdhyzbi.woff2",
  },
  {
    path: "fonts/poppins-400-latin.woff2",
    url: "https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrJJfecg.woff2",
  },
  {
    path: "fonts/poppins-400-latin-ext.woff2",
    url: "https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrJJnecmNE.woff2",
  },
  {
    path: "fonts/poppins-600-latin.woff2",
    url: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2",
  },
  {
    path: "fonts/poppins-600-latin-ext.woff2",
    url: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6Z1JlFc-K.woff2",
  },
  {
    path: "fonts/poppins-700-latin.woff2",
    url: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2",
  },
  {
    path: "fonts/poppins-700-latin-ext.woff2",
    url: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7Z1JlFc-K.woff2",
  },
];

async function loadFonts(): Promise<{ files: Record<string, Uint8Array>; warnings: string[] }> {
  const files: Record<string, Uint8Array> = {};
  const warnings: string[] = [];
  await Promise.all(
    FONT_SOURCES.map(async (font) => {
      const result = await resolveMediaBytes(font.url);
      if (result.ok) {
        files[font.path] = result.data;
      } else {
        warnings.push(`Font sa nepodarilo stiahnuť (${font.path}): ${result.error}`);
      }
    })
  );
  return { files, warnings };
}

export async function buildOfflinePresentationPackage(input: {
  quiz: QuizLibraryItem;
  events: QuizEvent[];
  cookieHeader?: string;
}): Promise<OfflinePackageResult> {
  const urls = collectQuizMediaUrls(input.quiz);
  const urlToLocal = new Map<string, string>();
  const mediaFiles: Record<string, Uint8Array> = {};
  const failedUrls: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const result = await resolveMediaBytes(url, input.cookieHeader);
    if (!result.ok) {
      failedUrls.push(url);
      warnings.push(`${url} — ${result.error}`);
      continue;
    }
    const fileName = safeMediaFileName(i, url, result.contentType);
    const localPath = `media/${fileName}`;
    mediaFiles[localPath] = result.data;
    urlToLocal.set(url, localPath);
  }

  if (failedUrls.length) {
    return {
      ok: false,
      error:
        "Offline balík sa nepodarilo vytvoriť — niektoré médiá sa nedajú stiahnuť. Nahraj chýbajúce súbory znova alebo oprav odkazy v kvíze.",
      failedUrls,
    };
  }

  const offlineQuiz = rewriteQuiz(input.quiz, urlToLocal);
  const offlineEvents = slimEvents(input.events);
  const { files: fontFiles, warnings: fontWarnings } = await loadFonts();
  warnings.push(...fontWarnings);

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    quiz: offlineQuiz,
    events: offlineEvents,
  };

  const dataJs = `window.__MUDRC_OFFLINE__=${JSON.stringify(payload)};`;
  const readme = [
    "MUDRC — offline prezentácia kvízu",
    "================================",
    "",
    `Kvíz: ${input.quiz.title}`,
    `Vytvorené: ${payload.generatedAt}`,
    "",
    "Ako spustiť (bez internetu):",
    "1. Rozbaľ tento ZIP do priečinka na disku (HDD/USB).",
    "2. Otvor súbor index.html v prehliadači (Chrome / Edge / Firefox).",
    "   — dvojklik na index.html, alebo pravý klik → Otvoriť pomocou.",
    "3. Vyber podnik (voliteľné), formát obrazovky a spusti projekciu.",
    "4. Ovládanie: klik / šípka vpravo / medzerník = ďalej; šípka vľavo / pravý klik = späť; F = celá obrazovka;",
    "   bočné tlačidlo myši (to isté čo online) = ukončiť projekciu a vrátiť sa na úvod.",
    "",
    "Dôležité:",
    "- Balík je samostatný: médiá a fonty sú vo vnútri ZIP. Internet už netreba.",
    "- Nerozdeľuj súbory — index.html, data.js a priečinok media/ musia ostať spolu.",
    "- Online prezentácia v admine ostáva nezmenená; toto je záloha na výpadok siete.",
    "",
  ].join("\n");

  const files: Record<string, Uint8Array> = {
    "README.txt": strToU8(readme),
    "index.html": strToU8(buildOfflinePlayerHtml()),
    "data.js": strToU8(dataJs),
    ...mediaFiles,
    ...fontFiles,
  };

  const zip = zipSync(files, { level: 0 });
  const fileName = `${safeZipBaseName(input.quiz.title, input.quiz.id)}-offline.zip`;

  return {
    ok: true,
    zip,
    fileName,
    mediaCount: Object.keys(mediaFiles).length,
    warnings,
  };
}
