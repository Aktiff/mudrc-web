"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type MutableRefObject,
} from "react";
import { Maximize2 } from "lucide-react";
import { formatEventDateLabel, quizIntervalDays, type QuizEvent } from "@/lib/data";
import { playbackMediaSrc } from "@/lib/media-url";
import { attachVolumeWheel } from "@/lib/media-volume";
import { displayQuestionNumber } from "@/lib/quiz-template";
import { VolumeAudio, VolumeVideo } from "@/components/VolumeMedia";
import { visibleRuleTexts } from "@/lib/quiz-rules";
import { findFutureQuiz, upcomingFutureQuizzes } from "@/lib/future-quizzes";
import { quizTypeOrDefault } from "@/lib/quiz-type";
import type { QuizLibraryItem, QuizQuestionItem } from "@/lib/quiz-library";
import { parseQuizPayload } from "@/lib/quiz-editor-draft";
import {
  bestPresentationImageUrl,
  buildPresentationSlides,
  shouldShowImageInAnswerPhase,
  shouldShowImageInQuestionPhase,
  shouldShowVideoInAnswerPhase,
  shouldShowVideoInQuestionPhase,
  videoQuestionClipSeconds,
  type PresentationSlide,
} from "@/lib/quiz-presentation";
import { findCorrectOptionIndex, getQuestionBodyText, getQuestionOptions, matchLetter, optionLetter } from "@/lib/quiz-question-options";
import {
  findHomeQuizEvent,
  formatNextQuizLine,
  formatNextQuizLines,
  MAX_NEXT_QUIZ_LINES,
  nextQuizMomentForEvent,
} from "@/lib/next-quiz-presentation";
import {
  PRESENTATION_ASPECT_OPTIONS,
  presentationStageBoxStyle,
  type PresentationAspectMode,
} from "@/lib/presentation-aspect";
import {
  PRESENTATION_FEATURES,
  presentationBadgeTimerSizes,
  shouldAutoFitQuestionSlide,
} from "@/lib/presentation-features";
import { fixSlovakLineBreaks } from "@/lib/slovak-typography";
import PresentationStageAutoFit from "@/components/PresentationStageAutoFit";
import PresentationZoomLayer from "@/components/PresentationZoomLayer";

type Props = {
  quizId: string;
  initialEventSlug?: string;
};

function SlideBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[#060606]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_35%,rgba(240,200,0,0.09),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_100%,rgba(0,0,0,0.85),transparent_60%)]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </>
  );
}

function RulesSlide({
  rules,
  specialRules = [],
  venueName,
}: {
  rules: string[];
  specialRules?: string[];
  venueName: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rulesKey = `${venueName}\n${specialRules.join("\n")}\n${rules.join("\n")}`;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const fit = () => {
      const maxH = viewport.clientHeight;
      const maxW = viewport.clientWidth;
      if (maxH < 1 || maxW < 1) return;

      let lo = 18;
      let hi = 64;
      let best = lo;
      for (let i = 0; i < 12; i += 1) {
        const mid = (lo + hi) / 2;
        content.style.fontSize = `${mid}px`;
        const tooBig = content.scrollHeight > maxH + 1 || content.scrollWidth > maxW + 1;
        if (tooBig) hi = mid;
        else {
          best = mid;
          lo = mid;
        }
      }
      content.style.fontSize = `${best}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [rulesKey]);

  const ruleItemClass = "flex items-baseline gap-[0.45em] w-full text-white/95 leading-snug";
  const listClass =
    "w-full max-w-none space-y-[0.28em] rounded-2xl border border-white/10 bg-white/[0.03] px-[0.7em] py-[0.45em]";

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 z-[5] flex items-center pointer-events-none overflow-hidden px-[2vw] py-[2vh]"
    >
      <div ref={contentRef} className="w-full flex flex-col justify-center gap-[0.4em]" style={{ fontSize: "42px" }}>
        {venueName && (
          <p className="text-[#f0c800]/70 tracking-wide text-center" style={{ fontSize: "0.72em" }}>
            {venueName}
          </p>
        )}
        {specialRules.length > 0 && (
          <>
            <p className="text-[#f0c800] tracking-wide font-semibold font-display text-center" style={{ fontSize: "0.85em" }}>
              Špeciálne pravidlá
            </p>
            <ul className={listClass}>
              {specialRules.map((rule, index) => (
                <li key={index} className={ruleItemClass}>
                  <span className="text-[#f0c800] font-display shrink-0 w-[1.4em] text-right tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{fixSlovakLineBreaks(rule)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-[#f0c800] tracking-wide font-semibold font-display text-center" style={{ fontSize: "0.85em" }}>
          Pravidlá
        </p>
        <ul className={listClass}>
          {rules.map((rule, index) => (
            <li key={index} className={ruleItemClass}>
              <span className="text-[#f0c800] font-display shrink-0 w-[1.4em] text-right tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">{fixSlovakLineBreaks(rule)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function questionTextStyle(
  text: string,
  withImage = false,
  imageWithOptions = false,
  matchQuestion = false
): CSSProperties {
  const len = text.length;
  const lineHeight = 1.45;

  if (withImage) {
    if (imageWithOptions) {
      if (len > 100) return { fontSize: "clamp(2.25rem, 4.8vmin, 4.5rem)", lineHeight };
      if (len > 60) return { fontSize: "clamp(2.5rem, 5.2vmin, 5rem)", lineHeight };
      if (len > 30) return { fontSize: "clamp(2.75rem, 5.8vmin, 5.75rem)", lineHeight };
      return { fontSize: "clamp(3rem, 6vmin, 6.25rem)", lineHeight };
    }
    if (len > 100) return { fontSize: "clamp(2.75rem, 6vmin, 5.5rem)", lineHeight };
    if (len > 60) return { fontSize: "clamp(3.25rem, 7vmin, 6.5rem)", lineHeight };
    if (len > 30) return { fontSize: "clamp(3.75rem, 8vmin, 7.5rem)", lineHeight };
    return { fontSize: "clamp(4rem, 8.5vmin, 8.5rem)", lineHeight };
  }

  if (matchQuestion) {
    if (len > 100) return { fontSize: "clamp(2.35rem, 5vmin, 5.25rem)", lineHeight };
    if (len > 60) return { fontSize: "clamp(2.55rem, 5.4vmin, 5.75rem)", lineHeight };
    return { fontSize: "clamp(2.75rem, 5.8vmin, 6.25rem)", lineHeight };
  }

  if (len > 140) return { fontSize: "clamp(3rem, 6.5vmin, 7rem)", lineHeight };
  if (len > 100) return { fontSize: "clamp(3.25rem, 7vmin, 7.75rem)", lineHeight };
  if (len > 70) return { fontSize: "clamp(3.5rem, 7.5vmin, 8.5rem)", lineHeight };
  if (len > 45) return { fontSize: "clamp(3.75rem, 8vmin, 9.25rem)", lineHeight };
  return { fontSize: "clamp(4rem, 8.5vmin, 10rem)", lineHeight };
}

const OPTION_LETTER_STYLE = { fontSize: "clamp(3.5rem, 7.5vmin, 8.5rem)" } as const;
const OPTION_TEXT_STYLE = { fontSize: "clamp(3rem, 6.5vmin, 7.5rem)", lineHeight: 1.45 } as const;
const ANSWER_TEXT_STYLE = { fontSize: "clamp(3.25rem, 7vmin, 8.5rem)", lineHeight: 1.45 } as const;
function matchMarkStyle(rows: number, compact: boolean): CSSProperties {
  if (compact) return { fontSize: rows > 5 ? "clamp(1.45rem, 3vmin, 2.6rem)" : "clamp(1.8rem, 3.8vmin, 3.4rem)" };
  if (rows <= 3) return { fontSize: "clamp(2.8rem, 6vmin, 5.5rem)" };
  if (rows <= 4) return { fontSize: "clamp(2.4rem, 5.2vmin, 4.6rem)" };
  if (rows <= 6) return { fontSize: "clamp(2rem, 4.2vmin, 3.6rem)" };
  return { fontSize: "clamp(1.55rem, 3.2vmin, 2.8rem)" };
}

function matchTextStyle(rows: number, compact: boolean): CSSProperties {
  const lineHeight = 1.25;
  if (compact) {
    return {
      fontSize: rows > 5 ? "clamp(1.25rem, 2.6vmin, 2.2rem)" : "clamp(1.5rem, 3.2vmin, 2.8rem)",
      lineHeight,
    };
  }
  if (rows <= 3) return { fontSize: "clamp(2.35rem, 5vmin, 4.6rem)", lineHeight };
  if (rows <= 4) return { fontSize: "clamp(2.05rem, 4.4vmin, 4rem)", lineHeight };
  if (rows <= 6) return { fontSize: "clamp(1.7rem, 3.6vmin, 3.15rem)", lineHeight };
  return { fontSize: "clamp(1.35rem, 2.8vmin, 2.4rem)", lineHeight };
}

function matchAnswerStyle(answer: string): CSSProperties {
  const lines = answer.split("\n").filter((line) => line.trim()).length;
  if (lines <= 4) return { fontSize: "clamp(1.75rem, 3.8vmin, 3.4rem)", lineHeight: 1.35 };
  if (lines <= 6) return { fontSize: "clamp(1.45rem, 3.1vmin, 2.7rem)", lineHeight: 1.3 };
  return { fontSize: "clamp(1.2rem, 2.5vmin, 2.15rem)", lineHeight: 1.28 };
}

const QUESTION_TEXT_CLASS =
  "relative z-[1] font-sans font-semibold text-white text-center tracking-normal whitespace-pre-wrap [text-wrap:pretty] drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] w-full max-w-full px-1 sm:px-2 py-[0.1em] shrink-0 normal-case overflow-visible";

/** Vnútorný okraj plátna — rovnaký zo všetkých strán, obsah ostáva vycentrovaný. */
const SLIDE_SAFE_AREA_CLASS =
  "w-full h-full max-h-full min-h-0 box-border px-[max(1.25rem,2.4vmin)] py-[max(1.25rem,2.8vmin)] flex flex-col items-center justify-center overflow-hidden";

function PresentationImage({
  src,
  variant,
  fillAvailable = false,
}: {
  src: string;
  variant: "hero" | "with-options" | "full-slide";
  fillAvailable?: boolean;
}) {
  const resolved = bestPresentationImageUrl(src);
  const sizeClass = fillAvailable
    ? "h-full w-full max-h-full max-w-full object-contain"
    : "max-w-[calc(100%-4px)] max-h-[calc(100%-4px)] w-auto h-auto object-contain";
  const className = `${sizeClass} rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt=""
      draggable={false}
      className={`${className} select-none`}
      decoding="async"
      onDragStart={(e) => e.preventDefault()}
    />
  );
}

function OptionsGrid({
  options,
  highlightCorrectIndex = -1,
  compact = false,
}: {
  options: string[];
  highlightCorrectIndex?: number;
  compact?: boolean;
}) {
  if (!options.length) return null;

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 w-full max-w-full ${
        compact ? "gap-4 sm:gap-5" : "gap-7 sm:gap-9"
      }`}
    >
      {options.map((option, index) => {
        const isCorrect = index === highlightCorrectIndex;

        return (
          <div
            key={`${index}-${option}`}
            className={`flex items-center gap-6 sm:gap-8 w-full rounded-2xl border-[3px] shadow-[0_12px_48px_rgba(0,0,0,0.45)] ${
              compact ? "px-6 sm:px-8 py-4 sm:py-5" : "px-8 sm:px-11 py-6 sm:py-8"
            } ${
              isCorrect
                ? "border-[#f0c800] bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black ring-4 ring-[#f0c800]/35"
                : "border-white/20 bg-white/[0.06] backdrop-blur-sm text-white"
            }`}
          >
            <span
              className={`font-display leading-none shrink-0 w-[5rem] sm:w-28 text-left ${
                isCorrect ? "text-black/70" : "text-[#f0c800]"
              }`}
              style={OPTION_LETTER_STYLE}
            >
              {optionLetter(index)})
            </span>
            <p
              className={`flex-1 min-w-0 font-sans font-semibold tracking-normal leading-[1.45] text-left normal-case overflow-visible py-[0.05em] ${
                isCorrect ? "font-bold" : ""
              }`}
              style={OPTION_TEXT_STYLE}
            >
              {fixSlovakLineBreaks(option)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MatchColumns({
  left,
  right,
  compact = false,
}: {
  left: string[];
  right: string[];
  compact?: boolean;
}) {
  const rows = Math.max(left.length, right.length, 1);
  const card = `flex items-center w-full rounded-2xl border-[3px] border-white/35 bg-white/[0.14] text-white shadow-[0_12px_48px_rgba(0,0,0,0.45)] ${
    compact ? "gap-3 px-4 py-3" : rows > 6 ? "gap-3 sm:gap-4 px-5 py-3" : "gap-4 sm:gap-5 px-6 sm:px-8 py-4 sm:py-5"
  }`;
  const markClass = `font-display leading-none shrink-0 text-[#f0c800] text-left ${
    compact ? "w-10 sm:w-12" : rows > 6 ? "w-12 sm:w-14" : "w-14 sm:w-20"
  }`;
  return (
    <div className={`grid grid-cols-2 items-start w-full max-w-full ${compact ? "gap-3" : rows > 6 ? "gap-3 sm:gap-4" : "gap-4 sm:gap-6"}`}>
      <div className={`flex flex-col min-w-0 ${compact || rows > 6 ? "gap-2.5" : "gap-3 sm:gap-4"}`}>
        {left.map((item, index) => (
          <div key={`left-${index}`} className={card}>
            <span className={markClass} style={matchMarkStyle(rows, compact)}>
              {index + 1}
            </span>
            <p className="flex-1 min-w-0 font-sans font-semibold normal-case text-left break-words" style={matchTextStyle(rows, compact)}>
              {fixSlovakLineBreaks(item)}
            </p>
          </div>
        ))}
      </div>
      <div className={`flex flex-col min-w-0 ${compact || rows > 6 ? "gap-2.5" : "gap-3 sm:gap-4"}`}>
        {right.map((item, index) => (
          <div key={`right-${index}`} className={card}>
            <span className={markClass} style={matchMarkStyle(rows, compact)}>
              {matchLetter(index)}
            </span>
            <p className="flex-1 min-w-0 font-sans font-semibold normal-case text-left break-words" style={matchTextStyle(rows, compact)}>
              {fixSlovakLineBreaks(item)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SoundOnlyVideo({
  src,
  playUntilSeconds,
  mediaRef,
}: {
  src: string;
  playUntilSeconds?: number;
  mediaRef?: MutableRefObject<HTMLMediaElement | null>;
}) {
  const [node, setNode] = useState<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className="w-full max-w-xl shrink-0"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <VolumeVideo
        ref={(el) => {
          setNode(el);
          if (mediaRef) mediaRef.current = el;
        }}
        captureWheel={false}
        playsInline
        preload="auto"
        playUntilSeconds={playUntilSeconds}
        src={src}
        className="fixed w-px h-px opacity-0 pointer-events-none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={() => {
          if (!node) return;
          if (node.paused) {
            if (playUntilSeconds && node.currentTime >= playUntilSeconds - 0.12) node.currentTime = 0;
            void node.play().catch(() => {});
          } else {
            node.pause();
          }
        }}
        className="w-full h-12 rounded-xl bg-black/70 border border-white/25 text-white text-base font-semibold"
      >
        {playing ? "Pozastaviť ukážku" : "Pustiť ukážku"}
      </button>
    </div>
  );
}

function QuestionContent({
  question,
  phase,
  presentationAudioRef,
}: {
  question: QuizQuestionItem;
  phase: "question" | "answer";
  presentationAudioRef?: MutableRefObject<HTMLMediaElement | null>;
}) {
  const showImage =
    phase === "question" ? shouldShowImageInQuestionPhase(question) : shouldShowImageInAnswerPhase(question);
  const showVideo =
    phase === "question" ? shouldShowVideoInQuestionPhase(question) : shouldShowVideoInAnswerPhase(question);
  const questionText = fixSlovakLineBreaks(getQuestionBodyText(question) || "Otázka");
  const options = getQuestionOptions(question);
  const correctOptionIndex =
    question.isOrderQuestion || question.isMatchQuestion
      ? -1
      : phase === "answer"
        ? findCorrectOptionIndex(options, question.answer)
        : -1;
  const imageHero = showImage && options.length === 0;
  const imageWithOptions = showImage && options.length > 0;
  const imageFocusedLayout = imageHero || imageWithOptions;

  const answerBoxClass =
    "shrink-0 px-6 sm:px-10 py-5 sm:py-6 rounded-2xl bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black text-center w-full max-w-full shadow-[0_20px_60px_rgba(240,200,0,0.25)]";

  const audioBlock = question.audioUrl?.trim() ? (
      <VolumeAudio
        key={playbackMediaSrc(question.audioUrl)}
        ref={(el) => {
          if (presentationAudioRef) presentationAudioRef.current = el;
        }}
        captureWheel={false}
        edgeFade={question.kind === "music" || question.audioEdgeFade === true}
        controls
        preload="auto"
        src={playbackMediaSrc(question.audioUrl)}
        className="w-full max-w-xl shrink-0 touch-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      />
    ) : null;

  const questionSoundOnly = phase === "question" && question.videoQuestionAudioOnly === true;
  const videoBlock = showVideo && question.videoUrl?.trim() ? (
      questionSoundOnly ? (
        <SoundOnlyVideo
          src={playbackMediaSrc(question.videoUrl) ?? ""}
          playUntilSeconds={videoQuestionClipSeconds(question)}
          mediaRef={presentationAudioRef}
        />
      ) : (
      <VolumeVideo
        captureWheel={false}
        controls
        playsInline
        playUntilSeconds={phase === "question" ? videoQuestionClipSeconds(question) : undefined}
        src={playbackMediaSrc(question.videoUrl)}
        className="w-full max-w-4xl max-h-[min(28vh,360px)] rounded-xl border border-white/10 bg-black touch-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      />
      )
    ) : null;

  const questionBlock = (
    <p
      className={`${QUESTION_TEXT_CLASS} shrink-0`}
      style={questionTextStyle(questionText, imageFocusedLayout, imageWithOptions, question.isMatchQuestion === true)}
    >
      {questionText}
    </p>
  );

  const imageBlock =
    showImage && question.imageUrl ? (
      <div className="min-h-0 h-full w-full flex items-center justify-center overflow-hidden p-[max(0.25rem,0.5vmin)] box-border">
        <PresentationImage
          src={question.imageUrl}
          variant={imageWithOptions ? "with-options" : "hero"}
          fillAvailable={imageFocusedLayout}
        />
      </div>
    ) : null;

  const footerBlock = (
    <div className="shrink-0 w-full flex flex-col gap-4 sm:gap-5">
      {question.isMatchQuestion ? (
        <MatchColumns left={options} right={question.matchRight ?? []} compact={imageWithOptions} />
      ) : options.length > 0 ? (
        <OptionsGrid
          options={options}
          highlightCorrectIndex={correctOptionIndex}
          compact={imageWithOptions}
        />
      ) : null}

      {phase === "answer" && options.length > 0 && correctOptionIndex < 0 && question.answer.trim() && (
        <div className={answerBoxClass}>
          <p
            className={`font-sans font-bold tracking-normal break-words normal-case whitespace-pre-line ${
              question.isMatchQuestion ? "text-left" : ""
            }`}
            style={question.isMatchQuestion ? matchAnswerStyle(question.answer) : ANSWER_TEXT_STYLE}
          >
            {fixSlovakLineBreaks(question.answer)}
          </p>
        </div>
      )}

      {phase === "answer" && options.length === 0 && (
        <div className={answerBoxClass}>
          <p className="font-sans font-bold tracking-normal break-words normal-case" style={ANSWER_TEXT_STYLE}>
            {fixSlovakLineBreaks(
              question.answer.trim() ||
                (question.musicArtist?.trim() && question.musicTitle?.trim()
                  ? `${question.musicArtist.trim()} — ${question.musicTitle.trim()}`
                  : "")
            ) || "—"}
          </p>
        </div>
      )}
    </div>
  );

  if (imageFocusedLayout) {
    return (
      <div className="w-full h-full max-w-full min-h-0 max-h-full box-border overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto] gap-[max(0.35rem,0.9vmin)] px-[max(0.35rem,0.8vmin)] py-[max(0.2rem,0.5vmin)]">
        <div className="shrink-0 w-full flex flex-col items-center gap-2 sm:gap-3 min-h-0">
          {audioBlock}
          {videoBlock}
          {questionBlock}
        </div>
        {imageBlock}
        {footerBlock}
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-h-0 max-h-full box-border overflow-visible flex flex-col items-center justify-center gap-6 sm:gap-8 px-[max(0.35rem,0.8vmin)] my-auto">
      {audioBlock}
      {videoBlock}
      {questionBlock}
      {imageBlock}
      {footerBlock}
    </div>
  );
}

function ImageSlide({
  question,
  media = "image",
  playUntilSeconds,
  audioOnly = false,
  presentationAudioRef,
}: {
  question: QuizQuestionItem;
  media?: "image" | "video";
  playUntilSeconds?: number;
  audioOnly?: boolean;
  presentationAudioRef?: MutableRefObject<HTMLMediaElement | null>;
}) {
  if (media === "video" && audioOnly) {
    if (!question.videoUrl?.trim()) return null;
    return (
      <div className="w-full h-full max-h-full min-h-0 flex-1 flex items-center justify-center overflow-hidden px-6">
        <SoundOnlyVideo
          src={playbackMediaSrc(question.videoUrl) ?? ""}
          playUntilSeconds={playUntilSeconds}
          mediaRef={presentationAudioRef}
        />
      </div>
    );
  }
  if (media === "video") {
    if (!question.videoUrl?.trim()) return null;
    return (
      <div className="w-full h-full max-h-full min-h-0 flex-1 flex items-center justify-center overflow-hidden px-2 py-2">
        <VolumeVideo
          captureWheel={false}
          controls
          playsInline
          playUntilSeconds={playUntilSeconds}
          src={playbackMediaSrc(question.videoUrl)}
          className="w-full h-full max-h-full max-w-full object-contain bg-black touch-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        />
      </div>
    );
  }
  if (!question.imageUrl?.trim()) return null;

  return (
    <div className="w-full h-full max-h-full min-h-0 flex-1 flex items-center justify-center overflow-hidden px-1 py-1">
      <PresentationImage src={question.imageUrl} variant="full-slide" />
    </div>
  );
}

function PresentationView({
  slide,
  eventRules,
  specialRules = [],
  venueName,
  nextQuizLines,
  presentationAudioRef,
}: {
  slide: PresentationSlide;
  eventRules: string[];
  specialRules?: string[];
  venueName: string;
  nextQuizLines: string[];
  presentationAudioRef?: MutableRefObject<HTMLMediaElement | null>;
}) {
  if (slide.type === "rules") {
    const rules = eventRules.length ? eventRules : ["Pravidlá nastav v admin → Udalosť → Pravidlá."];
    return <RulesSlide rules={rules} specialRules={specialRules} venueName={venueName} />;
  }
  if (slide.type === "round") {
    return (
      <div className="text-center px-8 w-full mx-auto">
        <p className="font-display text-7xl sm:text-9xl md:text-[10rem] text-white tracking-wide leading-none">
          {slide.title}
        </p>
        {slide.subtitle && <p className="text-xl sm:text-3xl text-white/65 mt-8 font-medium">{slide.subtitle}</p>}
      </div>
    );
  }
  if (slide.type === "correction") {
    const lineSizeClass =
      nextQuizLines.length >= 4
        ? "text-[clamp(1.45rem,3.4vw,3.35rem)]"
        : nextQuizLines.length >= 2
          ? "text-[clamp(1.7rem,4vw,4.25rem)]"
          : "text-[clamp(2rem,4.8vw,5.25rem)]";
    return (
      <div className="text-center px-2 sm:px-6 w-full max-w-[min(98vw,1680px)] mx-auto">
        <p className="font-display text-6xl sm:text-8xl text-[#f0c800] tracking-wide mb-6 sm:mb-8">
          Opravovanie
        </p>
        {nextQuizLines.length > 0 ? (
          <div className="space-y-4 sm:space-y-6 w-full">
            <p className="text-3xl sm:text-5xl text-white/70 font-semibold tracking-normal normal-case">
              {nextQuizLines.length === 1 ? "Najbližší kvíz:" : "Najbližšie kvízy:"}
            </p>
            <ul className="space-y-3 sm:space-y-5 w-full max-w-full">
              {nextQuizLines.map((line) => (
                <li
                  key={line}
                  className={`font-sans font-semibold text-white normal-case tracking-normal leading-tight ${lineSizeClass}`}
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }
  if (slide.type === "answers_intro") {
    return (
      <div className="text-center px-8 w-full mx-auto">
        <div className="w-24 h-1 mx-auto rounded-full bg-[#f0c800] mb-8" />
        <p className="font-display text-5xl sm:text-7xl md:text-8xl text-white tracking-wide">{slide.title}</p>
      </div>
    );
  }
  if (slide.type === "promo") {
    const logo = playbackMediaSrc(slide.promo.imageUrl);
    return (
      <div className="w-full h-full max-h-full min-h-0 flex flex-col items-center justify-center text-center px-[max(1rem,2vw)] gap-[max(0.75rem,2vh)]">
        <div className="w-24 h-1 rounded-full bg-[#f0c800] shrink-0" />
        {slide.promo.title.trim() ? (
          <p className="font-display text-[clamp(2rem,5vw,4.5rem)] text-[#f0c800] tracking-wide leading-tight">
            {slide.promo.title.trim()}
          </p>
        ) : null}
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="max-w-[min(70vw,720px)] max-h-[min(42vh,480px)] w-auto h-auto object-contain"
          />
        ) : null}
        {slide.promo.text.trim() ? (
          <p className="font-sans font-semibold text-white normal-case whitespace-pre-line leading-snug text-[clamp(1.35rem,3.2vw,2.75rem)] max-w-[min(92vw,1100px)]">
            {slide.promo.text.trim()}
          </p>
        ) : null}
      </div>
    );
  }
  if (slide.type === "scores") {
    return (
      <div className="text-center px-8 max-w-4xl w-full mx-auto">
        <p className="font-display text-6xl sm:text-8xl text-white tracking-wide">{slide.title}</p>
      </div>
    );
  }
  if (slide.type === "question_phase") {
    return (
      <div className="w-full h-full max-h-full min-h-0 flex flex-col items-center justify-center overflow-hidden">
        <QuestionContent
          question={slide.question}
          phase="question"
          presentationAudioRef={presentationAudioRef}
        />
      </div>
    );
  }
  if (slide.type === "image_slide") {
    return (
      <div className="w-full max-h-full min-h-0 flex flex-col items-center justify-center overflow-hidden">
        <ImageSlide
          question={slide.question}
          media={slide.media}
          playUntilSeconds={slide.playUntilSeconds}
          audioOnly={slide.audioOnly}
          presentationAudioRef={presentationAudioRef}
        />
      </div>
    );
  }
  if (slide.type === "answer_phase") {
    return (
      <div className="w-full h-full max-h-full min-h-0 flex flex-col items-center justify-center overflow-hidden">
        <QuestionContent
          question={slide.question}
          phase="answer"
          presentationAudioRef={presentationAudioRef}
        />
      </div>
    );
  }

  return null;
}

export default function QuizLibraryShow({ quizId, initialEventSlug = "" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const presentationAudioRef = useRef<HTMLMediaElement | null>(null);
  const [quiz, setQuiz] = useState<QuizLibraryItem | null>(null);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [eventSlug, setEventSlug] = useState(initialEventSlug);
  const [rulesTerm, setRulesTerm] = useState("");
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slideView, setSlideView] = useState({ scale: 1, x: 0, y: 0 });
  const [showNextQuizModal, setShowNextQuizModal] = useState(false);
  const [nextQuizLines, setNextQuizLines] = useState<string[]>([]);
  const [selectedNextQuizSlugs, setSelectedNextQuizSlugs] = useState<string[]>([]);
  const [homeNextQuizSlug, setHomeNextQuizSlug] = useState("");
  const [aspectMode, setAspectMode] = useState<PresentationAspectMode>("tv-16:9");
  useEffect(() => {
    let cancelled = false;
    const signal = AbortSignal.timeout(20000);
    Promise.all([
      fetch(`/api/admin/quiz-library/${quizId}?_=${Date.now()}`, { cache: "no-store", signal }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store", signal }).then((r) =>
        r.ok ? r.json() : { events: [] }
      ),
    ])
      .then(([quizData, eventsData]) => {
        if (cancelled) return;
        try {
          setQuiz(quizData ? parseQuizPayload(quizData) : null);
          setLoadError(quizData ? "" : "Kvíz sa nepodarilo načítať.");
        } catch (error) {
          setQuiz(null);
          setLoadError(error instanceof Error ? error.message : "Kvíz sa nepodarilo načítať.");
        }
        const list = eventsData && Array.isArray(eventsData.events) ? eventsData.events : [];
        setEvents(list);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setQuiz(null);
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        setLoadError(timedOut ? "Načítanie trvalo príliš dlho. Skús to znova." : "Kvíz sa nepodarilo načítať.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  useEffect(() => {
    if (initialEventSlug) {
      setEventSlug(initialEventSlug);
    }
  }, [initialEventSlug]);

  useEffect(() => {
    setRulesTerm("");
  }, [eventSlug]);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!started) return;
    const root = rootRef.current;
    if (!root) return;
    return attachVolumeWheel(root);
  }, [started]);

  const slides = useMemo(() => {
    if (!quiz?.questions?.length) return [];
    try {
      return buildPresentationSlides(quiz.questions, quiz.promos ?? []);
    } catch {
      return [];
    }
  }, [quiz?.questions, quiz?.promos]);

  const selectedEvent = events.find((event) => event.slug === eventSlug);
  const futureTerms = selectedEvent ? upcomingFutureQuizzes(selectedEvent) : [];
  const selectedExtra = selectedEvent && rulesTerm ? findFutureQuiz(selectedEvent, rulesTerm) : null;
  const eventRules = visibleRuleTexts(
    selectedExtra && Array.isArray(selectedExtra.rules) ? selectedExtra.rules : selectedEvent?.rules
  );
  const specialRules = selectedExtra
    ? visibleRuleTexts(selectedExtra.specialRules)
    : selectedEvent?.thematic
      ? visibleRuleTexts(selectedEvent.specialRules)
      : [];
  const venueName = selectedEvent
    ? selectedExtra
      ? `${selectedEvent.venue} · ${selectedExtra.quizType}`
      : `${selectedEvent.venue} · ${selectedEvent.city}`
    : "";
  const slide = slides[index];
  const progress = slides.length ? ((index + 1) / slides.length) * 100 : 0;
  const showSlideTimer = Boolean(started && slide && slide.type !== "rules");
  const slideTimerKey = showSlideTimer ? `${index}:${slide.type}` : null;

  const [slideElapsed, setSlideElapsed] = useState(0);

  useEffect(() => {
    if (!started || !slideTimerKey) {
      setSlideElapsed(0);
      return;
    }

    setSlideElapsed(0);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setSlideElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [slideTimerKey, started]);

  const nextQuizChoices = useMemo(() => {
    const active = events.filter((event) => event.active !== false && event.venue.trim());
    const home = active.find((event) => event.slug === homeNextQuizSlug);
    const rest = active
      .filter((event) => event.slug !== homeNextQuizSlug)
      .sort(
        (a, b) => a.city.localeCompare(b.city, "sk") || a.venue.localeCompare(b.venue, "sk")
      );
    return home ? [home, ...rest] : rest;
  }, [events, homeNextQuizSlug]);

  const openNextQuizModal = useCallback(() => {
    const home = findHomeQuizEvent(events, eventSlug);
    setHomeNextQuizSlug(home?.slug ?? "");
    setSelectedNextQuizSlugs(home ? [home.slug] : []);
    setShowNextQuizModal(true);
  }, [events, eventSlug]);

  const toggleNextQuizSlug = useCallback((slug: string) => {
    setSelectedNextQuizSlugs((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length >= MAX_NEXT_QUIZ_LINES) return current;
      return [...current, slug];
    });
  }, []);

  const confirmStartPresentation = useCallback(() => {
    const entries = selectedNextQuizSlugs.flatMap((slug) => {
      const event = events.find((item) => item.slug === slug);
      if (!event) return [];
      const at = nextQuizMomentForEvent(event, slug === homeNextQuizSlug);
      if (!at) return [];
      return [{ venue: event.venue, city: event.city, at }];
    });
    setNextQuizLines(formatNextQuizLines(entries));
    setShowNextQuizModal(false);
    setStarted(true);
  }, [events, homeNextQuizSlug, selectedNextQuizSlugs]);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleStageClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      goNext();
    },
    [goNext]
  );

  const togglePresentationAudio = useCallback(() => {
    const audio = presentationAudioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const handleStageAuxClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 1) return;
      if (!presentationAudioRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      togglePresentationAudio();
    },
    [togglePresentationAudio]
  );

  const onSlideView = useCallback((view: { scale: number; x: number; y: number }) => {
    setSlideView((prev) =>
      prev.scale === view.scale && prev.x === view.x && prev.y === view.y ? prev : view
    );
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!rootRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await rootRef.current.requestFullscreen();
      }
    } catch {
      /* prehliadač môže fullscreen zamietnuť */
    }
  }, []);

  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === "Escape" && document.fullscreenElement) {
        e.preventDefault();
        void document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, started, toggleFullscreen]);

  useEffect(() => {
    if (!started) return;
    const stay = { mudrcPresentation: "stay" };
    const close = { mudrcPresentation: "close" };
    let left = false;
    const onPop = (event: PopStateEvent) => {
      if (left) return;
      const marker = (event.state as { mudrcPresentation?: string } | null)?.mudrcPresentation;
      if (marker === "close") {
        left = true;
        window.location.replace("/admin/hotove-kvizy");
        return;
      }
      if (marker === "stay") return;
      window.history.forward();
    };
    window.addEventListener("popstate", onPop);
    window.history.pushState(stay, "");
    window.history.pushState(close, "");
    window.history.back();
    return () => {
      left = true;
      window.removeEventListener("popstate", onPop);
    };
  }, [started]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#060606] flex items-center justify-center text-white/70">
        Načítavam…
      </div>
    );
  }

  if (!slides.length) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#060606] flex flex-col items-center justify-center gap-4 text-white px-6 text-center">
        <p>{loadError || "Žiadne otázky. Doplň ich v editore."}</p>
        <Link href={`/admin/hotove-kvizy/${quizId}`} className="text-[#f0c800] underline">
          Späť do editora
        </Link>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#060606] text-white flex items-center justify-center p-6">
        <SlideBackdrop />
        <div className="relative w-full max-w-md space-y-6">
          <div>
            <p className="text-[#f0c800]/70 text-xs uppercase tracking-[0.3em] mb-3">Projekcia kvízu</p>
            <h1 className="font-display text-4xl tracking-wide mb-2">{quiz?.title}</h1>
            <p className="text-white/55 text-sm">
              Podnik je voliteľný — ak ho vyberieš, prvý slide zobrazí jeho pravidlá.
            </p>
          </div>
          <select
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white"
            value={eventSlug}
            onChange={(e) => setEventSlug(e.target.value)}
          >
            <option value="" className="text-black">
              — Bez podniku (generické pravidlá) —
            </option>
            {events.map((event) => (
              <option key={event.slug} value={event.slug} className="text-black">
                {event.venue} · {event.city}
              </option>
            ))}
          </select>
          {futureTerms.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm text-white/70">Pravidlá na prvom slide</span>
              <select
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white"
                value={rulesTerm}
                onChange={(e) => setRulesTerm(e.target.value)}
              >
                <option value="" className="text-black">
                  {selectedEvent
                    ? `${formatEventDateLabel(selectedEvent.date)} · ${quizTypeOrDefault(selectedEvent.quizType)}`
                    : "Bežný termín podniku"}
                </option>
                {futureTerms.map((quiz) => (
                  <option key={quiz.id} value={quiz.date} className="text-black">
                    {formatEventDateLabel(quiz.date)} · {quiz.quizType}
                  </option>
                ))}
              </select>
              <p className="text-xs text-white/45">
                Bežný termín podniku je prvý. Ďalšie riadky sú špeciálne večery. Formát obrazovky je až v poli pod tým.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <span className="text-sm text-white/70">Formát obrazovky</span>
            <select
              className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white"
              value={aspectMode}
              onChange={(e) => setAspectMode(e.target.value as PresentationAspectMode)}
            >
              {PRESENTATION_ASPECT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="text-black">
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/45">
              Na televízor vyber <span className="text-white/65">TV 16 : 9</span> — rovnaký vzhľad ako na PC, len sa
              zmestí do rámca.
            </p>
          </div>
          <button
            type="button"
            onClick={openNextQuizModal}
            className="w-full rounded-xl bg-[#f0c800] text-black font-bold py-3.5 hover:bg-[#ffd54f] transition-colors"
          >
            Spustiť projekciu
          </button>
          <Link href={`/admin/hotove-kvizy/${quizId}`} className="block text-center text-white/50 text-sm hover:text-white">
            Späť do editora
          </Link>
        </div>

        {showNextQuizModal && (
          <div
            className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowNextQuizModal(false)}
          >
            <div
              className="relative w-full max-w-lg max-h-[min(90vh,760px)] overflow-hidden rounded-2xl border border-white/15 bg-[#121212] p-6 sm:p-8 shadow-2xl flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="text-[#f0c800]/80 text-xs uppercase tracking-[0.25em] mb-2">Pred projekciou</p>
                <h2 className="font-display text-2xl tracking-wide">Najbližšie kvízy</h2>
                <p className="text-white/50 text-sm mt-2">
                  Zaklikni podniky. Na plátne budú zoradené podľa dátumu. Podnik, v ktorom práve si, je{" "}
                  {quizIntervalDays(events.find((event) => event.slug === homeNextQuizSlug)) === 7
                    ? "o týždeň"
                    : "o dva týždne"}{" "}
                  v rovnakom čase. Ostatné berú dátum a čas zo svojej udalosti. Najviac {MAX_NEXT_QUIZ_LINES}.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1">
                {(() => {
                  const selectedByDate = nextQuizChoices
                    .filter((item) => selectedNextQuizSlugs.includes(item.slug))
                    .map((item) => ({
                      slug: item.slug,
                      at: nextQuizMomentForEvent(item, item.slug === homeNextQuizSlug)?.getTime() ?? 0,
                    }))
                    .sort((a, b) => a.at - b.at);
                  return nextQuizChoices.map((event) => {
                  const order = selectedByDate.findIndex((item) => item.slug === event.slug);
                  const checked = order >= 0;
                  const full = !checked && selectedNextQuizSlugs.length >= MAX_NEXT_QUIZ_LINES;
                  const at = nextQuizMomentForEvent(event, event.slug === homeNextQuizSlug);
                  const line = at ? formatNextQuizLine(event.venue, at, event.city) : event.venue;
                  return (
                    <label
                      key={event.slug}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${
                        checked ? "border-[#f0c800]/60 bg-[#f0c800]/10" : "border-white/10 bg-white/5"
                      } ${full ? "opacity-40" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[#f0c800]"
                        checked={checked}
                        disabled={full}
                        onChange={() => toggleNextQuizSlug(event.slug)}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm text-white">
                          {checked && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f0c800] px-1.5 text-xs font-bold text-black">
                              {order + 1}
                            </span>
                          )}
                          <span className="font-semibold">{event.venue}</span>
                          <span className="text-white/45">{event.city}</span>
                        </span>
                        <span className="block text-sm text-white/70 mt-1">{line}</span>
                      </span>
                    </label>
                  );
                  });
                })()}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNextQuizModal(false)}
                  className="flex-1 rounded-xl border border-white/20 py-3 text-white/80 hover:bg-white/10 transition-colors"
                >
                  Zrušiť
                </button>
                <button
                  type="button"
                  onClick={confirmStartPresentation}
                  className="flex-1 rounded-xl bg-[#f0c800] text-black font-bold py-3 hover:bg-[#ffd54f] transition-colors"
                >
                  Spustiť projekciu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const activeQuestion =
    slide?.type === "question_phase" ||
    slide?.type === "answer_phase" ||
    slide?.type === "image_slide"
      ? slide.question
      : null;
  const showQuestionBadge =
    slide?.type === "question_phase" || slide?.type === "image_slide" || slide?.type === "answer_phase";

  const stageStyle = presentationStageBoxStyle(aspectMode);
  const slideKey = `${index}-${slide?.type ?? "none"}`;
  const questionAutoFit = shouldAutoFitQuestionSlide(aspectMode, slide?.type);
  const badgeTimer = presentationBadgeTimerSizes(PRESENTATION_FEATURES.badgeTimerSizeMultiplier);

  const zoomedOut = slideView.scale < 0.999;
  const stageFrameStyle: CSSProperties = {
    ...stageStyle,
    transformOrigin: "center center",
    transform: zoomedOut
      ? `translate(${slideView.x}px, ${slideView.y}px) scale(${slideView.scale})`
      : undefined,
  };

  return (
    <div ref={rootRef} className="fixed inset-0 z-[9999] bg-[#030303] flex items-center justify-center overflow-hidden">
      <div
        className={`relative text-white flex flex-col select-none shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ${
          zoomedOut ? "presentation-zoom-out overflow-visible" : "overflow-hidden"
        }`}
        style={stageFrameStyle}
        onContextMenu={(e) => {
          e.preventDefault();
          goPrev();
        }}
        role="presentation"
      >
        <SlideBackdrop />

      {!isFullscreen && (
        <div className="absolute top-0 inset-x-0 flex items-center justify-end p-4 sm:p-5 z-[80] pointer-events-none">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void toggleFullscreen();
            }}
            className="pointer-events-auto p-2.5 rounded-full bg-black/70 border border-white/20 hover:bg-white/15 backdrop-blur-sm transition-colors"
            title="Zväčšiť"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {showQuestionBadge && activeQuestion && (
        <div className="absolute top-4 sm:top-5 left-4 sm:left-5 z-[1] pointer-events-none">
          <div
            className={`${badgeTimer.boxClass} rounded-2xl bg-[#f0c800] shadow-[0_10px_40px_rgba(240,200,0,0.45)] ring-2 ring-[#f0c800]/40 flex items-center justify-center`}
            style={badgeTimer.boxStyle}
          >
            <span
              className={`font-display ${badgeTimer.textClass} text-black tabular-nums leading-none [font-variant-numeric:tabular-nums]`}
            >
              {displayQuestionNumber(activeQuestion)}
            </span>
          </div>
        </div>
      )}

      {showSlideTimer && (
        <div className="absolute top-4 sm:top-5 right-4 sm:right-5 z-[1] pointer-events-none">
          <div
            className={`${badgeTimer.timerClass} px-3 sm:px-4 rounded-2xl bg-black/80 border-2 border-white/30 backdrop-blur-sm shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center justify-center`}
            style={badgeTimer.timerStyle}
          >
            <span className={`font-mono ${badgeTimer.textClass} font-bold text-white tabular-nums leading-none`}>
              {slideElapsed}
            </span>
          </div>
        </div>
      )}

      <PresentationZoomLayer
        slideKey={slideKey}
        wheelMode={
          (slide?.type === "question_phase" || slide?.type === "answer_phase") &&
          activeQuestion &&
          (activeQuestion.kind === "music" ||
            activeQuestion.kind === "sound" ||
            activeQuestion.kind === "video" ||
            Boolean(activeQuestion.audioUrl?.trim()) ||
            Boolean(activeQuestion.videoUrl?.trim())) ||
          (slide?.type === "image_slide" && slide.media === "video")
            ? "volume"
            : "zoom"
        }
        className="relative z-[2] flex-1 flex min-h-0 w-full"
        innerClassName="min-h-0"
        onBackgroundClick={handleStageClick}
        onMiddleClick={handleStageAuxClick}
        onViewChange={onSlideView}
      >
        {slide?.type !== "rules" && (
          <PresentationStageAutoFit enabled={questionAutoFit} slideKey={slideKey} className={SLIDE_SAFE_AREA_CLASS}>
            {slide && (
              <div className="w-full h-full min-h-0 max-h-full flex flex-col items-center justify-center overflow-hidden">
                <PresentationView
                  slide={slide}
                  eventRules={eventRules}
                  specialRules={specialRules}
                  venueName={venueName}
                  nextQuizLines={nextQuizLines}
                  presentationAudioRef={presentationAudioRef}
                />
              </div>
            )}
          </PresentationStageAutoFit>
        )}
      </PresentationZoomLayer>
      {slide?.type === "rules" && (
        <RulesSlide
          rules={eventRules.length ? eventRules : ["Pravidlá nastav v admin → Udalosť → Pravidlá."]}
          specialRules={specialRules}
          venueName={venueName}
        />
      )}

      {!isFullscreen && (
        <div className="absolute bottom-0 inset-x-0 z-20">
          <div className="h-1 bg-white/10 mx-4 sm:mx-8 mb-4 sm:mb-5 rounded-full overflow-hidden pointer-events-none">
            <div
              className="h-full bg-gradient-to-r from-[#f0c800] to-[#ffd54f] transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
