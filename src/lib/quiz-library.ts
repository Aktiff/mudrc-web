import {
  buildStandardMudrcQuestions,
  migrateSlidesToQuestions,
  renumberQuizQuestionGroups,
} from "@/lib/quiz-template";
import { normalizeMatchColumn, normalizeQuestionOptions, parseEmbeddedOptions } from "@/lib/quiz-question-options";
import { normalizeTags } from "@/lib/quiz-question-tags";
import { teamKey } from "@/lib/poll";
import { DEFAULT_MUSIC_QUESTION_BODY, ensureMusicQuestionBody, isMusicBankId } from "@/lib/music-bank";
import { DEFAULT_SOUND_QUESTION_BODY } from "@/lib/sound-bank";
import { DEFAULT_VIDEO_QUESTION_BODY } from "@/lib/video-bank";

export type QuizQuestionKind = "normal" | "sound" | "video" | "music";

export type QuizQuestionItem = {
  id: string;
  roundNumber: number;
  questionNumber: number;
  /** Poradie v kole naprieč typmi. Prázdne = staré poradie, hudba na konci. */
  order?: number;
  kind: QuizQuestionKind;
  body: string;
  answer: string;
  /** Hudobná ukážka — interpret (1 bod) */
  musicArtist?: string;
  /** Hudobná ukážka — názov skladby (1 bod) */
  musicTitle?: string;
  /** Voliteľné možnosti A–F (zobrazené v dvoch stĺpcoch pri projekcii) */
  options?: string[];
  /** true = možnosti boli raz premiešané pri vložení z banky (nemeň pri načítaní) */
  optionsShuffledFromBank?: boolean;
  /** Položky na zoradenie. options je premiešané poradie na plátno, answer je správne poradie. */
  isOrderQuestion?: boolean;
  /** Priraďovanie. options je ľavá strana (čísla), matchRight je pravá (písmená), answer je 1C, 2A, 3B. */
  isMatchQuestion?: boolean;
  matchRight?: string[];
  /** ID otázky z banky vloženej do tohto slotu */
  bankQuestionId?: string;
  imageUrl?: string;
  audioUrl?: string;
  /** true = v prezentácii prvá a posledná sekunda plynulo nabehne a dobehne */
  audioEdgeFade?: boolean;
  videoUrl?: string;
  /** Fullscreen video pred otázkou. */
  videoBeforeQuestion?: boolean;
  /** Video na slide s otázkou a odpoveďou. */
  videoDuringQuestion?: boolean;
  /** Fullscreen video hneď po otázke. */
  videoOnNextSlide?: boolean;
  /** Video pri správnej odpovedi. */
  videoOnAnswerSlide?: boolean;
  /** Fullscreen video pred správnou odpoveďou. */
  videoBeforeAnswer?: boolean;
  /** Fullscreen video po správnej odpovedi. */
  videoAfterAnswer?: boolean;
  /** V otázke pustiť len toľko sekúnd od začiatku. Pri odpovedi ide video celé. */
  videoQuestionSeconds?: number;
  /** Pri otázke ide len zvuk z videa. Obraz sa ukáže pri odpovediach. */
  videoQuestionAudioOnly?: boolean;
  /** Popis ukážky z banky (zvuk / video) — pre vrátenie do banky */
  mediaLabel?: string;
  /** true = obrázok aj pri otázke */
  imageDuringQuestion: boolean;
  /** true = fullscreen slide s fotkou pred otázkou */
  imageBeforeQuestion?: boolean;
  /** true = obrázok na samostatnom fullscreen slide hneď po otázke */
  imageOnNextSlide?: boolean;
  /** true = obrázok pri slide so správnou odpoveďou */
  imageOnAnswerSlide?: boolean;
  /** true = fullscreen slide s fotkou pred slide so správnou odpoveďou */
  imageBeforeAnswer?: boolean;
  /** true = fullscreen slide s fotkou hneď po slide so správnou odpoveďou */
  imageAfterAnswer?: boolean;
  /** Tématické tagy pre vyváženie kvízu (napr. história, geografia) */
  tags?: string[];
  /** Poznámka pre kvízmistra — len admin, nie na projektore */
  hostNote?: string;
};

/** Slide s logom a textom, napríklad sponzor cien. */
export type QuizPromoSlide = {
  id: string;
  /** Po správnych odpovediach tohto kola. 0 = pred vyhodnotením. */
  afterRound: number;
  title: string;
  text: string;
  imageUrl?: string;
};

export type QuizLibraryItem = {
  id: string;
  title: string;
  questions: QuizQuestionItem[];
  notes?: string;
  promos?: QuizPromoSlide[];
  /** ID otázok z banky už vložených do tohto kvízu */
  usedBankQuestionIds?: string[];
  createdAt: string;
  updatedAt: string;
  formatVersion: number;
};

export type QuizUsage = {
  eventSlug: string;
  venue: string;
  city: string;
  date: string;
  quizResultId: string;
  winnerTeam: string;
  teamNames: string[];
};

/** Otázka, v ktorej už niečo je. Prázdny slot a predvolený text hudby sa neráta. */
export function isQuizQuestionFilled(question: QuizQuestionItem): boolean {
  const body = question.body.trim();
  const hasBody = Boolean(body) && !(question.kind === "music" && body === DEFAULT_MUSIC_QUESTION_BODY);
  const hasOptions = (question.options ?? []).some((option) => option.trim());
  const hasMatch = (question.matchRight ?? []).some((option) => option.trim());
  return Boolean(
    hasBody ||
      question.answer.trim() ||
      question.audioUrl?.trim() ||
      question.videoUrl?.trim() ||
      question.imageUrl?.trim() ||
      question.musicArtist?.trim() ||
      question.musicTitle?.trim() ||
      hasOptions ||
      hasMatch
  );
}

export function countFilledQuizQuestions(questions: QuizQuestionItem[] | undefined): number {
  return (questions ?? []).filter(isQuizQuestionFilled).length;
}

export function questionCountLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} otázka`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} otázky`;
  return `${n} otázok`;
}

export function createLibraryQuizId(): string {
  return `quiz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultLibraryQuiz(title = "Nový kvíz"): QuizLibraryItem {
  const now = new Date().toISOString();
  return {
    id: createLibraryQuizId(),
    title,
    createdAt: now,
    updatedAt: now,
    formatVersion: 2,
    questions: buildStandardMudrcQuestions(),
  };
}

function clipSeconds(value: unknown): number | undefined {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.round(raw * 10) / 10;
}

/** Staré video bez volieb ostane na otázke aj pri odpovedi. Uložené voľby sa berú každá zvlášť. */
function videoPlacementFromInput(input: Partial<QuizQuestionItem>): Pick<
  QuizQuestionItem,
  | "videoBeforeQuestion"
  | "videoDuringQuestion"
  | "videoOnNextSlide"
  | "videoOnAnswerSlide"
  | "videoBeforeAnswer"
  | "videoAfterAnswer"
> {
  const hasVideo = Boolean(input.videoUrl?.trim());
  const specified =
    input.videoBeforeQuestion !== undefined ||
    input.videoDuringQuestion !== undefined ||
    input.videoOnNextSlide !== undefined ||
    input.videoOnAnswerSlide !== undefined ||
    input.videoBeforeAnswer !== undefined ||
    input.videoAfterAnswer !== undefined;
  if (!specified) {
    return {
      videoBeforeQuestion: false,
      videoDuringQuestion: hasVideo,
      videoOnNextSlide: false,
      videoOnAnswerSlide: hasVideo,
      videoBeforeAnswer: false,
      videoAfterAnswer: false,
    };
  }
  return {
    videoBeforeQuestion: Boolean(input.videoBeforeQuestion),
    videoDuringQuestion: Boolean(input.videoDuringQuestion),
    videoOnNextSlide: Boolean(input.videoOnNextSlide),
    videoOnAnswerSlide: Boolean(input.videoOnAnswerSlide),
    videoBeforeAnswer: Boolean(input.videoBeforeAnswer),
    videoAfterAnswer: Boolean(input.videoAfterAnswer),
  };
}

function normalizeQuestion(input: Partial<QuizQuestionItem>): QuizQuestionItem | null {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const roundNumber = Number(input.roundNumber);
  const questionNumber = Number(input.questionNumber);
  if (
    !id ||
    !Number.isFinite(roundNumber) ||
    roundNumber < 1 ||
    !Number.isFinite(questionNumber) ||
    questionNumber < 1
  ) {
    return null;
  }

  const isMatchQuestion = input.isMatchQuestion === true;
  let body = ensureMusicQuestionBody(
    input.kind === "music" || isMusicBankId(typeof input.bankQuestionId === "string" ? input.bankQuestionId : "")
      ? "music"
      : "",
    input.body?.trim() ?? ""
  );
  let options = isMatchQuestion ? normalizeMatchColumn(input.options) : normalizeQuestionOptions(input.options);

  if (!isMatchQuestion && !options?.length && body) {
    const parsed = parseEmbeddedOptions(body);
    if (parsed.options.length) {
      body = parsed.questionText;
      options = parsed.options;
    }
  }

  return {
    id: String(input.id),
    roundNumber: Number(input.roundNumber),
    questionNumber: Number(input.questionNumber),
    ...(Number.isFinite(Number(input.order)) ? { order: Number(input.order) } : {}),
    kind:
      input.kind === "music"
        ? "music"
        : input.kind === "sound"
          ? "sound"
          : input.kind === "video"
            ? "video"
            : "normal",
    body,
    answer: input.answer?.trim() ?? "",
    musicArtist: input.musicArtist?.trim() || undefined,
    musicTitle: input.musicTitle?.trim() || undefined,
    options,
    optionsShuffledFromBank:
      input.optionsShuffledFromBank === true ? true : undefined,
    isOrderQuestion: input.isOrderQuestion === true && !isMatchQuestion ? true : undefined,
    isMatchQuestion: isMatchQuestion ? true : undefined,
    matchRight: isMatchQuestion ? normalizeMatchColumn(input.matchRight) : undefined,
    bankQuestionId: input.bankQuestionId?.trim() || undefined,
    imageUrl: input.imageUrl?.trim() || undefined,
    audioUrl: input.audioUrl?.trim() || undefined,
    audioEdgeFade: input.audioEdgeFade === true ? true : undefined,
    videoUrl: input.videoUrl?.trim() || undefined,
    ...videoPlacementFromInput(input),
    videoQuestionSeconds: clipSeconds(input.videoQuestionSeconds),
    videoQuestionAudioOnly: input.videoQuestionAudioOnly === true ? true : undefined,
    mediaLabel: input.mediaLabel?.trim() || undefined,
    imageDuringQuestion: Boolean(input.imageDuringQuestion),
    imageBeforeQuestion: Boolean(input.imageBeforeQuestion),
    imageOnNextSlide: Boolean(input.imageOnNextSlide),
    imageOnAnswerSlide:
      input.imageOnAnswerSlide !== undefined
        ? Boolean(input.imageOnAnswerSlide)
        : Boolean(
            input.imageUrl?.trim() &&
              (input.imageDuringQuestion ||
                (!input.imageOnNextSlide &&
                  !input.imageBeforeQuestion &&
                  !input.imageBeforeAnswer &&
                  !input.imageAfterAnswer))
          ),
    imageBeforeAnswer: Boolean(input.imageBeforeAnswer),
    imageAfterAnswer: Boolean(input.imageAfterAnswer),
    tags: normalizeTags(input.tags),
    hostNote: input.hostNote?.trim() || undefined,
  };
}

function normalizePromos(input: unknown): QuizPromoSlide[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: QuizPromoSlide[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<QuizPromoSlide>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const text = typeof row.text === "string" ? row.text.trim() : "";
    const imageUrl = typeof row.imageUrl === "string" ? row.imageUrl.trim() : "";
    if (!id && !title && !text && !imageUrl) continue;
    const afterRound = Number(row.afterRound);
    out.push({
      id: id || `promo-${out.length + 1}`,
      afterRound: Number.isFinite(afterRound) && afterRound >= 0 && afterRound <= 12 ? Math.round(afterRound) : 0,
      title,
      text,
      imageUrl: imageUrl || undefined,
    });
  }
  return out.length ? out : undefined;
}

export function promoSlideIsVisible(promo: Pick<QuizPromoSlide, "title" | "text" | "imageUrl">): boolean {
  return Boolean(promo.title.trim() || promo.text.trim() || promo.imageUrl?.trim());
}

export function normalizeLibraryQuiz(
  input: Partial<QuizLibraryItem> & { slides?: unknown[] }
): QuizLibraryItem {
  const title = input.title?.trim() || "Bez názvu";
  const now = new Date().toISOString();

  let questions: QuizQuestionItem[] = [];
  const rawQuestionCount = Array.isArray(input.questions) ? input.questions.length : 0;

  if (Array.isArray(input.questions) && input.questions.length) {
    questions = input.questions
      .map((q) => normalizeQuestion(q as QuizQuestionItem))
      .filter((q): q is QuizQuestionItem => Boolean(q));
    if (questions.length === 0 && rawQuestionCount > 0) {
      throw new Error(
        "Kvíz sa nepodarilo spracovať — otázky mali neplatný formát. Nič sa neuložilo; skús obnoviť zálohu."
      );
    }
  } else if (Array.isArray(input.slides) && input.slides.length) {
    questions = migrateSlidesToQuestions(input.slides as import("@/lib/quiz-deck").QuizSlide[]);
  }

  if (!questions.length) {
    questions = buildStandardMudrcQuestions();
  } else {
    questions = renumberQuizQuestionGroups(questions);
  }

  const bankIdsFromQuestions = questions
    .map((q) => q.bankQuestionId?.trim())
    .filter((id): id is string => Boolean(id));
  const usedBankQuestionIdsInput = Array.isArray(input.usedBankQuestionIds)
    ? input.usedBankQuestionIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const usedBankQuestionIds = Array.from(new Set([...usedBankQuestionIdsInput, ...bankIdsFromQuestions]));
  const promos = normalizePromos(input.promos);

  return {
    id: input.id?.trim() || createLibraryQuizId(),
    title,
    notes: input.notes?.trim() || undefined,
    promos,
    questions,
    usedBankQuestionIds: usedBankQuestionIds.length ? usedBankQuestionIds : undefined,
    formatVersion: 2,
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

export function parseTeamFilterInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getConflictingTeams(playedTeamNames: string[], filterTeams: string[]): string[] {
  const played = new Set(playedTeamNames.map((name) => teamKey(name)));
  const seen = new Set<string>();
  const conflicts: string[] = [];
  for (const team of filterTeams) {
    const key = teamKey(team);
    if (!played.has(key) || seen.has(key)) continue;
    seen.add(key);
    conflicts.push(team);
  }
  return conflicts;
}

export function isQuizSafeForTeams(playedTeamNames: string[], filterTeams: string[]): boolean {
  if (!filterTeams.length) return true;
  return getConflictingTeams(playedTeamNames, filterTeams).length === 0;
}

export function collectPlayedTeamNames(usages: QuizUsage[]): string[] {
  const names: string[] = [];
  for (const usage of usages) {
    names.push(...usage.teamNames);
  }
  return names;
}

export function isQuestionSlotEmpty(question: QuizQuestionItem): boolean {
  if (question.kind === "music") {
    return !question.answer.trim() && !question.audioUrl?.trim();
  }
  return !question.body.trim() && !question.answer.trim();
}

export function findFirstEmptyMusicSlot(questions: QuizQuestionItem[]): QuizQuestionItem | undefined {
  return [...questions]
    .filter((q) => q.kind === "music")
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .find(isQuestionSlotEmpty);
}

/** Prvá prázdna otázka v kole (vrátane bývalých hudobných slotov). */
export function findFirstEmptyContentSlot(questions: QuizQuestionItem[]): QuizQuestionItem | undefined {
  return [...questions]
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .find(isQuestionSlotEmpty);
}

export function findFirstEmptyQuestionSlot(questions: QuizQuestionItem[]): QuizQuestionItem | undefined {
  return [...questions]
    .filter((q) => q.kind === "normal")
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .find(isQuestionSlotEmpty);
}

export function collectUsedBankQuestionIdsFromQuiz(quiz: QuizLibraryItem): string[] {
  const live = new Set<string>();
  for (const question of quiz.questions ?? []) {
    if (question.bankQuestionId) live.add(question.bankQuestionId);
  }
  const ids = new Set<string>(live);
  for (const id of quiz.usedBankQuestionIds ?? []) {
    if (!id) continue;
    if (isMusicBankId(id) && !live.has(id)) continue;
    ids.add(id);
  }
  return Array.from(ids);
}

export function collectGlobalUsedBankQuestionIds(quizzes: QuizLibraryItem[]): string[] {
  const ids = new Set<string>();
  for (const quiz of quizzes) {
    for (const id of collectUsedBankQuestionIdsFromQuiz(quiz)) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

export function quizQuestionBodyKey(body: string | undefined | null): string {
  return (body ?? "").trim().toLocaleLowerCase("sk").replace(/\s+/g, " ");
}

export function quizQuestionAnswerKey(answer: string | undefined | null): string {
  return (answer ?? "").trim().toLocaleLowerCase("sk").replace(/\s+/g, " ");
}

/** Rovnaké zadanie aj rovnaká odpoveď. Iná odpoveď je iná otázka, aj keď text zadania sedí. */
export function sameQuizQuestionVariant(
  left: { body?: string | null; answer?: string | null },
  right: { body?: string | null; answer?: string | null }
): boolean {
  const body = quizQuestionBodyKey(left.body);
  return Boolean(body) && body === quizQuestionBodyKey(right.body) && quizQuestionAnswerKey(left.answer) === quizQuestionAnswerKey(right.answer);
}

const GENERIC_MEDIA_QUESTION_BODIES = new Set(
  [
    DEFAULT_MUSIC_QUESTION_BODY,
    "Napíš meno interpreta a názov skladby",
    DEFAULT_SOUND_QUESTION_BODY,
    DEFAULT_VIDEO_QUESTION_BODY,
  ].map((body) => quizQuestionBodyKey(body))
);

/** Znenie otázky, ktorá už prišla z banky. Otázka napísaná v editore banku neschová. */
export function collectUsedQuestionBodyKeys(
  quizzes: Array<{ questions?: Array<{ body?: string; answer?: string; bankQuestionId?: string }> }>
): string[] {
  const keys = new Set<string>();
  for (const quiz of quizzes) {
    for (const question of quiz.questions ?? []) {
      if (!question.bankQuestionId) continue;
      const body = quizQuestionBodyKey(question.body);
      if (!body || GENERIC_MEDIA_QUESTION_BODIES.has(body)) continue;
      keys.add(`${body}\n${quizQuestionAnswerKey(question.answer)}`);
    }
  }
  return Array.from(keys);
}
