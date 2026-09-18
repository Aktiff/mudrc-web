import type { CSSProperties } from "react";
import type { PresentationAspectMode } from "@/lib/presentation-aspect";

/**
 * Prepínače prezentácie — zmeň na false / 1 ak treba vrátiť staré správanie bez revertu v git.
 */
export const PRESENTATION_FEATURES = {
  /** Koliesko môže oddialiť pod 100 % (okrem auto-fit na otázkach). */
  manualZoomOut: true,
  minManualZoomScale: 0.55,
  maxManualZoomScale: 4,

  /**
   * V letterbox režimoch zmenší celú otázku len ak presahuje rám (inak scale 1).
   * Neplatí pre pravidlá, kolá atď.
   */
  questionOverflowAutoFit: true,

  /** 1 = plná veľkosť badge a timeru na slide. */
  badgeTimerSizeMultiplier: 1,
} as const;

const QUESTION_SLIDE_TYPES = new Set(["question_phase", "answer_phase", "image_slide"]);

export function shouldAutoFitQuestionSlide(
  aspectMode: PresentationAspectMode,
  slideType: string | undefined
): boolean {
  if (!PRESENTATION_FEATURES.questionOverflowAutoFit) return false;
  if (aspectMode === "viewport") return false;
  if (!slideType || !QUESTION_SLIDE_TYPES.has(slideType)) return false;
  return true;
}

const BADGE_TIMER_FULL = {
  boxClass: "size-[4.75rem] sm:size-24 md:size-28",
  timerClass: "min-w-[4.75rem] sm:min-w-24 md:min-w-28 h-[4.75rem] sm:h-24 md:h-28",
  textClass: "text-[3.25rem] sm:text-6xl md:text-7xl",
} as const;

/** ~12 % menšie (multiplier 0.88) — statické triedy kvôli Tailwind JIT. */
const BADGE_TIMER_COMPACT = {
  boxClass: "size-[4.18rem] sm:size-[5.28rem] md:size-[6.16rem]",
  timerClass:
    "min-w-[4.18rem] sm:min-w-[5.28rem] md:min-w-[6.16rem] h-[4.18rem] sm:h-[5.28rem] md:h-[6.16rem]",
  textClass: "text-[2.86rem] sm:text-[3.3rem] md:text-[3.85rem]",
} as const;

export type PresentationBadgeTimerSizes = {
  boxClass: string;
  timerClass: string;
  textClass: string;
  boxStyle?: CSSProperties;
  timerStyle?: CSSProperties;
};

export function presentationBadgeTimerSizes(multiplier: number): PresentationBadgeTimerSizes {
  if (multiplier >= 0.999) return { ...BADGE_TIMER_FULL };
  if (multiplier >= 0.84) return { ...BADGE_TIMER_COMPACT };
  const style: CSSProperties = { transform: `scale(${multiplier})`, transformOrigin: "center center" };
  return { ...BADGE_TIMER_FULL, boxStyle: style, timerStyle: style };
}
