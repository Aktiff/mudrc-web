import { buildStandardMudrcQuestions, migrateSlidesToQuestions } from "@/lib/quiz-template";
import { normalizeQuestionOptions, parseEmbeddedOptions } from "@/lib/quiz-question-options";
import { normalizeTags } from "@/lib/quiz-question-tags";
import { teamKey } from "@/lib/poll";

export type QuizQuestionKind = "normal" | "music";

export type QuizQuestionItem = {
  id: string;
  roundNumber: number;
  questionNumber: number;
  kind: QuizQuestionKind;
  body: string;
  answer: string;
  /** Voliteľné možnosti A–F (zobrazené v dvoch stĺpcoch pri projekcii) */
  options?: string[];
  /** ID otázky z banky vloženej do tohto slotu */
  bankQuestionId?: string;
  imageUrl?: string;
  audioUrl?: string;
  /** true = obrázok aj pri otázke */
  imageDuringQuestion: boolean;
  /** true = fullscreen slide s fotkou pred otázkou */
  imageBeforeQuestion?: boolean;
  /** true = obrázok na samostatnom fullscreen slide hneď po otázke */
  imageOnNextSlide?: boolean;
  /** true = obrázok pri slide so správnou odpoveďou */
  imageOnAnswerSlide?: boolean;
  /** Tématické tagy pre vyváženie kvízu (napr. história, geografia) */
  tags?: string[];
  /** Poznámka pre kvízmistra — len admin, nie na projektore */
  hostNote?: string;
};

export type QuizLibraryItem = {
  id: string;
  title: string;
  questions: QuizQuestionItem[];
  notes?: string;
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

function normalizeQuestion(input: Partial<QuizQuestionItem>): QuizQuestionItem | null {
  if (!input.id || !input.roundNumber || !input.questionNumber) return null;

  let body = input.body?.trim() ?? "";
  let options = normalizeQuestionOptions(input.options);

  if (!options?.length && body) {
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
    kind: input.kind === "music" ? "music" : "normal",
    body,
    answer: input.answer?.trim() ?? "",
    options,
    bankQuestionId: input.bankQuestionId?.trim() || undefined,
    imageUrl: input.imageUrl?.trim() || undefined,
    audioUrl: input.audioUrl?.trim() || undefined,
    imageDuringQuestion: Boolean(input.imageDuringQuestion),
    imageBeforeQuestion: Boolean(input.imageBeforeQuestion),
    imageOnNextSlide: Boolean(input.imageOnNextSlide),
    imageOnAnswerSlide:
      input.imageOnAnswerSlide !== undefined
        ? Boolean(input.imageOnAnswerSlide)
        : Boolean(
            input.imageUrl?.trim() &&
              (input.imageDuringQuestion ||
                (!input.imageOnNextSlide && !input.imageBeforeQuestion))
          ),
    tags: normalizeTags(input.tags),
    hostNote: input.hostNote?.trim() || undefined,
  };
}

export function normalizeLibraryQuiz(
  input: Partial<QuizLibraryItem> & { slides?: unknown[] }
): QuizLibraryItem {
  const title = input.title?.trim() || "Bez názvu";
  const now = new Date().toISOString();

  let questions: QuizQuestionItem[] = [];
  if (Array.isArray(input.questions) && input.questions.length) {
    questions = input.questions
      .map((q) => normalizeQuestion(q as QuizQuestionItem))
      .filter((q): q is QuizQuestionItem => Boolean(q));
  } else if (Array.isArray(input.slides) && input.slides.length) {
    questions = migrateSlidesToQuestions(input.slides as import("@/lib/quiz-deck").QuizSlide[]);
  }

  if (!questions.length) {
    questions = buildStandardMudrcQuestions();
  }

  const bankIdsFromQuestions = questions
    .map((q) => q.bankQuestionId?.trim())
    .filter((id): id is string => Boolean(id));
  const usedBankQuestionIdsInput = Array.isArray(input.usedBankQuestionIds)
    ? input.usedBankQuestionIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const usedBankQuestionIds = Array.from(new Set([...usedBankQuestionIdsInput, ...bankIdsFromQuestions]));

  return {
    id: input.id?.trim() || createLibraryQuizId(),
    title,
    notes: input.notes?.trim() || undefined,
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
  return !question.body.trim() && !question.answer.trim();
}

export function findFirstEmptyQuestionSlot(questions: QuizQuestionItem[]): QuizQuestionItem | undefined {
  return [...questions]
    .filter((q) => q.kind === "normal")
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .find(isQuestionSlotEmpty);
}

export function collectUsedBankQuestionIdsFromQuiz(quiz: QuizLibraryItem): string[] {
  const ids = new Set<string>();
  for (const id of quiz.usedBankQuestionIds ?? []) {
    if (id) ids.add(id);
  }
  for (const question of quiz.questions ?? []) {
    if (question.bankQuestionId) ids.add(question.bankQuestionId);
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
