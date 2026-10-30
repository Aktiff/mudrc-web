import type { QuizQuestionItem } from "@/lib/quiz-library";

const OPTION_LINE = /^[A-F]\)\s*(.+)$/i;
const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export function parseEmbeddedOptions(body: string): { questionText: string; options: string[] } {
  const lines = body.split("\n");
  const options: string[] = [];
  let splitIndex = lines.length;

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line) {
      if (options.length) splitIndex = i;
      continue;
    }
    const match = line.match(OPTION_LINE);
    if (match) {
      options.unshift(match[1].trim());
      splitIndex = i;
    } else {
      break;
    }
  }

  if (options.length < 2) {
    return { questionText: body.trim(), options: [] };
  }

  const questionText = lines
    .slice(0, splitIndex)
    .join("\n")
    .trim();
  return { questionText, options };
}

export function normalizeQuestionOptions(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options = raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
  return options.length ? options : undefined;
}

export function getQuestionOptions(question: QuizQuestionItem): string[] {
  if (question.options?.length) {
    return question.options.filter((option) => typeof option === "string" && option.trim());
  }
  return parseEmbeddedOptions(question.body ?? "").options;
}

export function getQuestionBodyText(question: QuizQuestionItem): string {
  const body = typeof question.body === "string" ? question.body : "";
  if (question.options?.length) {
    return body.trim();
  }
  const parsed = parseEmbeddedOptions(body);
  if (parsed.options.length) return parsed.questionText;
  return body.trim();
}

export function optionLetter(index: number): string {
  return OPTION_LETTERS[index] ?? String(index + 1);
}

export function findCorrectOptionIndex(options: string[], answer: string): number {
  const normalizedAnswer = answer.trim().toLowerCase();
  if (!normalizedAnswer) return -1;
  return options.findIndex((option) => option.trim().toLowerCase() === normalizedAnswer);
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: string, round: number): number {
  let state = (hashSeed(seed) + Math.imul(round, 2654435761)) >>> 0;
  state = Math.imul(state ^ (state >>> 16), 2246822519);
  state = Math.imul(state ^ (state >>> 13), 3266489917);
  return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
}

/** Fisher-Yates s deterministickým seedom — rovnaké id = rovnaké poradie, ale vyvážené A–F v banke. */
export function shuffleQuestionOptionsDeterministic<T extends { options: string[]; correctIndex: number; answer: string }>(
  item: T,
  seed: string
): T {
  if (item.options.length < 2) return item;

  const indices = item.options.map((_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededUnit(seed, i) * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledOptions = indices.map((index) => item.options[index]!);
  const correctSourceIndex = Math.min(Math.max(item.correctIndex, 0), item.options.length - 1);
  const newCorrectIndex = indices.indexOf(correctSourceIndex);
  const answer = item.options[correctSourceIndex] ?? item.answer;

  return {
    ...item,
    options: shuffledOptions as T["options"],
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : item.correctIndex,
    answer,
  };
}

/** Náhodné premiešanie pri vložení — tá istá banková otázka môže mať inú pozíciu správnej odpovede. */
export function shuffleQuestionOptionsRandom<T extends { options: string[]; correctIndex: number; answer: string }>(
  item: T
): T {
  if (item.options.length < 2) return item;

  const indices = item.options.map((_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledOptions = indices.map((index) => item.options[index]!);
  const correctSourceIndex = Math.min(Math.max(item.correctIndex, 0), item.options.length - 1);
  const newCorrectIndex = indices.indexOf(correctSourceIndex);
  const answer = item.options[correctSourceIndex] ?? item.answer;

  return {
    ...item,
    options: shuffledOptions as T["options"],
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : item.correctIndex,
    answer,
  };
}

export const ORDER_OPTION_MAX = 10;
export const MATCH_LEFT_MAX = 10;
export const MATCH_RIGHT_MAX = 6;
export const MATCH_PAIR_MAX = MATCH_LEFT_MAX;
const MATCH_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export type MatchPair = { left: string; right: string };

export function matchLetter(index: number): string {
  return MATCH_LETTERS[index] ?? String(index + 1);
}

export function normalizeMatchColumn(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .slice(0, MATCH_PAIR_MAX)
    .map((value) => (typeof value === "string" ? value.trim() : ""));
  return items.some(Boolean) ? items : undefined;
}

function uniqueMatchRights(values: string[]): string[] {
  const seen = new Set<string>();
  const rights: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = text.toLocaleLowerCase("sk");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rights.push(text);
    if (rights.length >= MATCH_RIGHT_MAX) break;
  }
  return rights;
}

export function validateMatchColumns(left: string[], right: string[]): { pairs: MatchPair[]; error: string } {
  const count = Math.min(MATCH_PAIR_MAX, Math.max(left.length, right.length));
  const pairs: MatchPair[] = [];
  for (let index = 0; index < count; index += 1) {
    const leftText = left[index]?.trim() ?? "";
    const rightText = right[index]?.trim() ?? "";
    if (!leftText && !rightText) continue;
    if (!leftText || !rightText) return { pairs: [], error: "Každá ľavá položka musí mať priradenú pravú stranu." };
    pairs.push({ left: leftText, right: rightText });
  }
  if (pairs.length < 2) return { pairs: [], error: "Na ľavej strane zadaj aspoň dve položky." };
  if (uniqueMatchRights(pairs.map((pair) => pair.right)).length < 2) {
    return { pairs: [], error: "Na pravej strane zadaj aspoň dve možnosti." };
  }
  return { pairs, error: "" };
}

/** Ľavá strana a pravá strana majú vlastný počet. assign je index pravej možnosti pri každej ľavej položke. */
export function validateMatchDraft(
  left: string[],
  right: string[],
  assign: number[]
): { pairs: MatchPair[]; error: string } {
  const targets = right.slice(0, MATCH_RIGHT_MAX);
  const storedLeft: string[] = [];
  const storedRight: string[] = [];
  for (let index = 0; index < Math.min(left.length, MATCH_LEFT_MAX); index += 1) {
    const leftText = left[index]?.trim() ?? "";
    if (!leftText) continue;
    const target = targets[assign[index] ?? 0]?.trim() ?? "";
    storedLeft.push(leftText);
    storedRight.push(target);
  }
  return validateMatchColumns(storedLeft, storedRight);
}

export function matchDraftFromColumns(
  left: string[],
  right: string[]
): { left: string[]; right: string[]; assign: number[] } {
  const targets: string[] = [];
  const items: string[] = [];
  const assign: number[] = [];
  const count = Math.min(MATCH_LEFT_MAX, Math.max(left.length, right.length));
  for (let index = 0; index < count; index += 1) {
    const leftText = (left[index] ?? "").trim();
    const rightText = (right[index] ?? "").trim();
    if (!leftText && !rightText) continue;
    let targetIndex = targets.findIndex((item) => item.toLocaleLowerCase("sk") === rightText.toLocaleLowerCase("sk"));
    if (rightText && targetIndex < 0 && targets.length < MATCH_RIGHT_MAX) {
      targets.push(rightText);
      targetIndex = targets.length - 1;
    }
    if (targetIndex < 0) targetIndex = 0;
    if (leftText) {
      items.push(leftText);
      assign.push(targetIndex);
    }
  }
  while (targets.length < 2) targets.push("");
  while (items.length < 2) {
    assign.push(Math.min(items.length, Math.max(0, targets.length - 1)));
    items.push("");
  }
  return { left: items, right: targets, assign };
}

export function matchPairsFromColumns(left: string[], right: string[]): MatchPair[] {
  return validateMatchColumns(left, right).pairs;
}

export function formatMatchBankAnswer(pairs: MatchPair[]): string {
  return pairs.map((pair, index) => `${index + 1}. ${pair.left} → ${pair.right}`).join("\n");
}

export function matchPairsFromBankAnswer(answer: string): MatchPair[] {
  const pairs: MatchPair[] = [];
  for (const line of answer.split(/\n+/)) {
    const match = line.trim().match(/^\d+\.\s*(.+?)\s+→\s+(.+)$/);
    if (!match) continue;
    const left = match[1]?.trim() ?? "";
    const right = match[2]?.trim() ?? "";
    if (left && right) pairs.push({ left, right });
    if (pairs.length >= MATCH_PAIR_MAX) break;
  }
  return pairs;
}

export function letterIndexesFromMatchAnswer(answer: string, leftCount: number, rightCount = leftCount): number[] {
  const limit = Math.max(1, Math.min(MATCH_RIGHT_MAX, rightCount));
  const letters = Array.from({ length: leftCount }, () => 0);
  for (const line of answer.split(/\n+/)) {
    const match = line.trim().match(/^(\d+)\s*([A-F])\b/i);
    if (!match) continue;
    const numberIndex = Number(match[1]) - 1;
    const letterIndex = match[2].toUpperCase().charCodeAt(0) - 65;
    if (numberIndex >= 0 && numberIndex < leftCount && letterIndex >= 0 && letterIndex < limit) {
      letters[numberIndex] = letterIndex;
    }
  }
  return letters;
}

export function formatMatchQuizAnswer(left: string[], right: string[], letterByNumber: number[]): string {
  return left
    .map((item, index) => {
      const letterIndex = letterByNumber[index] ?? 0;
      const leftText = item.trim();
      const rightText = right[letterIndex]?.trim() ?? "";
      if (!leftText && !rightText) return "";
      return `${index + 1}${matchLetter(letterIndex)}  ${leftText} — ${rightText}`;
    })
    .filter(Boolean)
    .join("\n");
}

function shuffleIndexes(count: number): number[] {
  const indexes = Array.from({ length: count }, (_, index) => index);
  for (let index = count - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = indexes[index] ?? index;
    indexes[index] = indexes[swapIndex] ?? swapIndex;
    indexes[swapIndex] = current;
  }
  return indexes;
}

/** Do kvízu sa ľavá strana a jedinečné pravé možnosti zamiešajú. Viac položiek môže mať to isté písmeno. */
export function shuffleMatchPairs(left: string[], right: string[]): { left: string[]; right: string[]; answer: string } {
  const pairs = matchPairsFromColumns(left, right).slice(0, MATCH_LEFT_MAX);
  const targets = uniqueMatchRights(pairs.map((pair) => pair.right));
  const targetIndex = (value: string) =>
    targets.findIndex((item) => item.toLocaleLowerCase("sk") === value.trim().toLocaleLowerCase("sk"));
  const lettersFor = (orderLeft: number[], orderRight: number[]) =>
    orderLeft.map((pairIndex) => {
      const found = targetIndex(pairs[pairIndex]?.right ?? "");
      const letter = orderRight.indexOf(found);
      return letter >= 0 ? letter : 0;
    });

  if (pairs.length < 2 || targets.length < 2) {
    const shownLeft = pairs.map((pair) => pair.left);
    const shownRight = targets.length ? targets : uniqueMatchRights(pairs.map((pair) => pair.right));
    const orderRight = shownRight.map((_, index) => index);
    return {
      left: shownLeft,
      right: shownRight,
      answer: formatMatchQuizAnswer(shownLeft, shownRight, lettersFor(pairs.map((_, index) => index), orderRight)),
    };
  }

  let leftOrder = pairs.map((_, index) => index);
  let rightOrder = targets.map((_, index) => index);
  const stillAligned = () =>
    pairs.length === targets.length &&
    leftOrder.every((pairIndex, display) => rightOrder[display] === targetIndex(pairs[pairIndex]?.right ?? ""));
  for (let attempt = 0; attempt < 8 && stillAligned(); attempt += 1) {
    leftOrder = shuffleIndexes(pairs.length);
    rightOrder = shuffleIndexes(targets.length);
  }
  if (stillAligned() && targets.length > 1) {
    const last = targets.length - 1;
    const saved = rightOrder[last] ?? last;
    rightOrder[last] = rightOrder[last - 1] ?? last - 1;
    rightOrder[last - 1] = saved;
  }
  if (leftOrder.every((value, index) => value === index) && rightOrder.every((value, index) => value === index)) {
    leftOrder = shuffleIndexes(pairs.length);
    rightOrder = shuffleIndexes(targets.length);
  }

  const shownLeft = leftOrder.map((index) => pairs[index]?.left ?? "");
  const shownRight = rightOrder.map((index) => targets[index] ?? "");
  return {
    left: shownLeft,
    right: shownRight,
    answer: formatMatchQuizAnswer(shownLeft, shownRight, lettersFor(leftOrder, rightOrder)),
  };
}

export function matchPairsFromQuiz(left: string[], right: string[], answer: string): MatchPair[] {
  const letters = letterIndexesFromMatchAnswer(answer, left.length, right.length);
  const pairs: MatchPair[] = [];
  for (let index = 0; index < left.length && pairs.length < MATCH_PAIR_MAX; index += 1) {
    const leftText = left[index]?.trim() ?? "";
    const rightText = right[letters[index] ?? index]?.trim() ?? "";
    if (leftText && rightText) pairs.push({ left: leftText, right: rightText });
  }
  return pairs.length >= 2 ? pairs : matchPairsFromColumns(left, right);
}

export function applyMatchColumnEdit(input: {
  left: string[];
  right: string[];
  answer: string;
  side: "left" | "right";
  index: number;
  value: string;
}): { left: string[]; right: string[]; answer: string } {
  const left = [...input.left];
  const right = [...input.right];
  if (input.side === "left") left[input.index] = input.value;
  else right[input.index] = input.value;
  const letters = letterIndexesFromMatchAnswer(input.answer, left.length, right.length);
  return { left, right, answer: formatMatchQuizAnswer(left, right, letters) };
}

export function moveMatchColumn(input: {
  left: string[];
  right: string[];
  answer: string;
  side: "left" | "right";
  index: number;
  direction: -1 | 1;
}): { left: string[]; right: string[]; answer: string } | null {
  const target = input.index + input.direction;
  const left = [...input.left];
  const right = [...input.right];
  const count = input.side === "left" ? left.length : right.length;
  if (target < 0 || target >= count) return null;
  const letters = letterIndexesFromMatchAnswer(input.answer, left.length, right.length);
  if (input.side === "left") {
    const item = left[input.index] ?? "";
    left[input.index] = left[target] ?? "";
    left[target] = item;
    const letter = letters[input.index] ?? input.index;
    letters[input.index] = letters[target] ?? target;
    letters[target] = letter;
  } else {
    const item = right[input.index] ?? "";
    right[input.index] = right[target] ?? "";
    right[target] = item;
    for (let index = 0; index < letters.length; index += 1) {
      if (letters[index] === input.index) letters[index] = target;
      else if (letters[index] === target) letters[index] = input.index;
    }
  }
  return { left, right, answer: formatMatchQuizAnswer(left, right, letters) };
}

export function setMatchLetter(input: {
  left: string[];
  right: string[];
  answer: string;
  index: number;
  letterIndex: number;
}): { left: string[]; right: string[]; answer: string } {
  const letters = letterIndexesFromMatchAnswer(input.answer, input.left.length, input.right.length);
  const max = Math.max(0, input.right.length - 1);
  letters[input.index] = Math.max(0, Math.min(max, input.letterIndex));
  return { left: input.left, right: input.right, answer: formatMatchQuizAnswer(input.left, input.right, letters) };
}

export function addMatchSide(input: {
  left: string[];
  right: string[];
  answer: string;
  side: "left" | "right";
}): { left: string[]; right: string[]; answer: string } | null {
  const left = [...input.left];
  const right = [...input.right];
  if (input.side === "left") {
    if (left.length >= MATCH_LEFT_MAX) return null;
    left.push("");
  } else if (right.length >= MATCH_RIGHT_MAX) {
    return null;
  } else {
    right.push("");
  }
  const letters = letterIndexesFromMatchAnswer(input.answer, left.length, right.length);
  if (input.side === "left") letters[left.length - 1] = 0;
  return { left, right, answer: formatMatchQuizAnswer(left, right, letters) };
}

export function removeMatchSide(input: {
  left: string[];
  right: string[];
  answer: string;
  side: "left" | "right";
  index: number;
}): { left: string[]; right: string[]; answer: string } | null {
  const left = [...input.left];
  const right = [...input.right];
  const letters = letterIndexesFromMatchAnswer(input.answer, left.length, right.length);
  if (input.side === "left") {
    if (left.length <= 2 || input.index < 0 || input.index >= left.length) return null;
    left.splice(input.index, 1);
    letters.splice(input.index, 1);
  } else {
    if (right.length <= 2 || input.index < 0 || input.index >= right.length) return null;
    right.splice(input.index, 1);
    for (let index = 0; index < letters.length; index += 1) {
      const letter = letters[index] ?? 0;
      if (letter === input.index) letters[index] = 0;
      else if (letter > input.index) letters[index] = letter - 1;
    }
  }
  return { left, right, answer: formatMatchQuizAnswer(left, right, letters) };
}

export function formatOrderAnswer(items: string[]): string {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

export function orderItemsFromAnswer(answer: string): string[] {
  return answer
    .split(/\n+/)
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean)
    .slice(0, ORDER_OPTION_MAX);
}

export function shuffleOrderItems(items: string[]): string[] {
  const source = items.map((item) => item.trim()).filter(Boolean);
  if (source.length < 2) return source;
  let next = [...source];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    next = [...source];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const left = next[i];
      next[i] = next[j] ?? "";
      next[j] = left ?? "";
    }
    if (next.some((item, index) => item !== source[index])) break;
  }
  return next.filter(Boolean);
}

/** Jednorazové premiešanie možností pri vkladaní z banky do slotu kvízu. */
export function shuffleQuestionOptionsForBankInsert(input: {
  options: string[];
  correctIndex: number;
  answer: string;
}): { options: string[]; answer: string } {
  const padded = [...input.options];
  while (padded.length < 6) padded.push("");

  const activeOptions = padded.map((o) => o.trim()).filter(Boolean);
  if (activeOptions.length < 2) {
    return { options: activeOptions, answer: input.answer.trim() };
  }

  const activeSourceIndices = padded
    .map((option, index) => (option.trim() ? index : -1))
    .filter((index) => index >= 0);
  let correctIndex = activeSourceIndices.indexOf(input.correctIndex);
  if (correctIndex < 0) {
    correctIndex = activeOptions.findIndex(
      (o) => o.trim().toLowerCase() === input.answer.trim().toLowerCase()
    );
  }
  if (correctIndex < 0) correctIndex = 0;

  const six: string[] = [...activeOptions];
  while (six.length < 6) six.push("");

  const mixed = shuffleQuestionOptionsRandom({
    options: six as string[] & { length: 6 },
    correctIndex,
    answer: activeOptions[correctIndex] ?? input.answer,
  });

  return {
    options: mixed.options.map((o) => o.trim()).filter(Boolean),
    answer: mixed.answer.trim(),
  };
}
