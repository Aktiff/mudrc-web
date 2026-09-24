"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Maximize2, X } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import type { QuizLibraryItem, QuizQuestionItem } from "@/lib/quiz-library";
import {
  bestPresentationImageUrl,
  buildPresentationSlides,
  shouldShowImageInAnswerPhase,
  shouldShowImageInQuestionPhase,
  type PresentationSlide,
} from "@/lib/quiz-presentation";
import { findCorrectOptionIndex, getQuestionBodyText, getQuestionOptions, optionLetter } from "@/lib/quiz-question-options";
import {
  defaultNextQuizDate,
  defaultNextQuizDateAfter,
  eventToDatetimeLocalValue,
  formatNextQuizLines,
  getUpcomingQuizEvents,
  MAX_NEXT_QUIZ_LINES,
  parseDatetimeLocalValue,
  toDatetimeLocalValue,
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

function RulesSlide({ rules, venueName }: { rules: string[]; venueName: string }) {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl px-8 mx-auto">
      {venueName && (
        <p className="text-[#f0c800]/70 text-lg sm:text-xl tracking-wide">{venueName}</p>
      )}
      <div className="w-16 h-1 rounded-full bg-gradient-to-r from-transparent via-[#f0c800] to-transparent" />
      <p className="text-[#f0c800] text-2xl sm:text-3xl tracking-wide font-semibold font-display">Pravidlá</p>
      <ul className="space-y-4 w-full rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 sm:p-10">
        {rules.map((rule, index) => (
          <li key={index} className="flex gap-5 text-lg sm:text-2xl text-white/95 leading-snug">
            <span className="text-[#f0c800] font-display text-3xl sm:text-4xl shrink-0 w-8 text-right">{index + 1}</span>
            <span>{fixSlovakLineBreaks(rule)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function questionTextStyle(text: string, withImage = false): CSSProperties {
  const len = text.length;
  const lineHeight = 1.45;

  if (withImage) {
    if (len > 100) return { fontSize: "clamp(2.75rem, 6vmin, 5.5rem)", lineHeight };
    if (len > 60) return { fontSize: "clamp(3.25rem, 7vmin, 6.5rem)", lineHeight };
    if (len > 30) return { fontSize: "clamp(3.75rem, 8vmin, 7.5rem)", lineHeight };
    return { fontSize: "clamp(4rem, 8.5vmin, 8.5rem)", lineHeight };
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

const QUESTION_TEXT_CLASS =
  "relative z-[1] font-sans font-semibold text-white text-center tracking-normal whitespace-pre-wrap [text-wrap:pretty] drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] w-full max-w-full px-1 sm:px-2 py-[0.1em] shrink-0 normal-case overflow-visible";

/** Vnútorný okraj plátna — rovnaký zo všetkých strán, obsah ostáva vycentrovaný. */
const SLIDE_SAFE_AREA_CLASS =
  "w-full h-full max-h-full min-h-0 box-border px-[max(1.25rem,2.4vmin)] py-[max(1.25rem,2.8vmin)] flex flex-col items-center justify-center overflow-hidden";

function PresentationImage({
  src,
  variant,
}: {
  src: string;
  variant: "hero" | "with-options" | "full-slide";
}) {
  const resolved = bestPresentationImageUrl(src);
  const className =
    variant === "full-slide"
      ? "max-w-[calc(100%-4px)] max-h-[calc(100%-4px)] w-auto h-auto object-contain rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
      : variant === "hero"
        ? "max-w-[calc(100%-4px)] max-h-[calc(100%-4px)] w-auto h-auto object-contain rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
        : "max-w-[calc(100%-4px)] max-h-[calc(100%-4px)] w-auto h-auto object-contain rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolved} alt="" className={className} decoding="async" />
  );
}

function OptionsGrid({
  options,
  highlightCorrectIndex = -1,
}: {
  options: string[];
  highlightCorrectIndex?: number;
}) {
  if (!options.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 sm:gap-9 w-full max-w-full">
      {options.map((option, index) => {
        const isCorrect = index === highlightCorrectIndex;

        return (
          <div
            key={`${index}-${option}`}
            className={`flex items-center gap-6 sm:gap-8 w-full px-8 sm:px-11 py-6 sm:py-8 rounded-2xl border-[3px] shadow-[0_12px_48px_rgba(0,0,0,0.45)] ${
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

function QuestionContent({
  question,
  phase,
}: {
  question: QuizQuestionItem;
  phase: "question" | "answer";
}) {
  const showImage =
    phase === "question" ? shouldShowImageInQuestionPhase(question) : shouldShowImageInAnswerPhase(question);
  const questionText = fixSlovakLineBreaks(getQuestionBodyText(question) || "Otázka");
  const options = getQuestionOptions(question);
  const correctOptionIndex =
    phase === "answer" ? findCorrectOptionIndex(options, question.answer) : -1;
  const imageHero = showImage && options.length === 0;
  const imageWithOptions = showImage && options.length > 0;

  const answerBoxClass =
    "shrink-0 px-6 sm:px-10 py-5 sm:py-6 rounded-2xl bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black text-center w-full max-w-full shadow-[0_20px_60px_rgba(240,200,0,0.25)]";

  return (
    <div
      className={`w-full max-w-full min-h-0 max-h-full box-border overflow-hidden ${
        imageHero
          ? "max-h-full grid grid-rows-[auto_minmax(0,1fr)_auto] gap-[max(0.75rem,1.8vmin)] px-[max(0.35rem,0.8vmin)] py-[max(0.25rem,0.6vmin)]"
          : "flex flex-col items-center justify-center gap-6 sm:gap-8 px-[max(0.35rem,0.8vmin)] overflow-visible"
      }`}
    >
      {(question.kind === "music" || question.kind === "sound") && question.audioUrl?.trim() && (
        <audio
          controls
          src={question.audioUrl}
          className="w-full max-w-xl"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        />
      )}

      {question.kind === "video" && question.videoUrl?.trim() && (
        <video
          controls
          playsInline
          src={question.videoUrl}
          className="w-full max-w-4xl max-h-[50vh] rounded-xl border border-white/10 bg-black"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        />
      )}

      <p
        className={`${QUESTION_TEXT_CLASS} shrink-0`}
        style={questionTextStyle(questionText, imageHero || imageWithOptions)}
      >
        {questionText}
      </p>

      {showImage && question.imageUrl && (
        <div
          className={
            imageHero
              ? "min-h-0 w-full flex items-center justify-center overflow-hidden p-[max(0.5rem,1.2vmin)] box-border"
              : "w-full flex items-center justify-center shrink-0 max-h-[min(42vh,100%)] overflow-hidden p-[max(0.5rem,1.2vmin)] box-border"
          }
        >
          <PresentationImage
            src={question.imageUrl}
            variant={imageHero ? "hero" : imageWithOptions ? "with-options" : "hero"}
          />
        </div>
      )}

      {options.length > 0 && (
        <OptionsGrid options={options} highlightCorrectIndex={correctOptionIndex} />
      )}

      {phase === "answer" && options.length > 0 && correctOptionIndex < 0 && question.answer.trim() && (
        <div className={answerBoxClass}>
          <p className="font-sans font-bold tracking-normal break-words normal-case" style={ANSWER_TEXT_STYLE}>
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
}

function ImageSlide({ question }: { question: QuizQuestionItem }) {
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
  venueName,
  nextQuizLines,
}: {
  slide: PresentationSlide;
  eventRules: string[];
  venueName: string;
  nextQuizLines: string[];
}) {
  if (slide.type === "rules") {
    const rules = eventRules.length ? eventRules : ["Pravidlá nastav v admin → Udalosť → Pravidlá."];
    return <RulesSlide rules={rules} venueName={venueName} />;
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
    return (
      <div className="text-center px-6 sm:px-10 max-w-6xl w-full mx-auto">
        <p className="font-display text-7xl sm:text-9xl text-[#f0c800] tracking-wide mb-12 sm:mb-16 md:mb-20">
          Opravovanie
        </p>
        {nextQuizLines.length > 0 ? (
          <div className="space-y-6 sm:space-y-8 md:space-y-10">
            <p className="text-3xl sm:text-5xl md:text-6xl text-white/60 font-semibold tracking-wide">
              {nextQuizLines.length === 1 ? "Najbližší kvíz:" : "Najbližšie kvízy:"}
            </p>
            <ul className="space-y-4 sm:space-y-6 md:space-y-8 px-2">
              {nextQuizLines.map((line) => (
                <li
                  key={line}
                  className={`font-display text-white leading-tight tracking-wide ${
                    nextQuizLines.length >= 4
                      ? "text-2xl sm:text-4xl md:text-5xl"
                      : nextQuizLines.length >= 2
                        ? "text-3xl sm:text-5xl md:text-6xl lg:text-7xl"
                        : "text-4xl sm:text-6xl md:text-7xl lg:text-8xl"
                  }`}
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
  if (slide.type === "scores") {
    return (
      <div className="text-center px-8 max-w-4xl w-full mx-auto">
        <p className="font-display text-6xl sm:text-8xl text-white tracking-wide">{slide.title}</p>
      </div>
    );
  }
  if (slide.type === "question_phase") {
    return (
      <div className="w-full max-h-full min-h-0 flex flex-col items-center justify-center overflow-visible">
        <QuestionContent question={slide.question} phase="question" />
      </div>
    );
  }
  if (slide.type === "image_slide") {
    return (
      <div className="w-full max-h-full min-h-0 flex flex-col items-center justify-center overflow-hidden">
        <ImageSlide question={slide.question} />
      </div>
    );
  }
  if (slide.type === "answer_phase") {
    return (
      <div className="w-full max-h-full min-h-0 flex flex-col items-center justify-center overflow-visible">
        <QuestionContent question={slide.question} phase="answer" />
      </div>
    );
  }

  return null;
}

export default function QuizLibraryShow({ quizId, initialEventSlug = "" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [quiz, setQuiz] = useState<QuizLibraryItem | null>(null);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [eventSlug, setEventSlug] = useState(initialEventSlug);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNextQuizModal, setShowNextQuizModal] = useState(false);
  const [nextQuizLines, setNextQuizLines] = useState<string[]>([]);
  const [nextQuizWizardIndex, setNextQuizWizardIndex] = useState(0);
  const [nextQuizDraftVenue, setNextQuizDraftVenue] = useState("");
  const [nextQuizDraftAtLocal, setNextQuizDraftAtLocal] = useState(() =>
    toDatetimeLocalValue(defaultNextQuizDate())
  );
  const [upcomingEventHints, setUpcomingEventHints] = useState<QuizEvent[]>([]);
  const [savedNextQuizSteps, setSavedNextQuizSteps] = useState<{ venue: string; atLocal: string }[]>([]);
  const [aspectMode, setAspectMode] = useState<PresentationAspectMode>("tv-16:9");

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/quiz-library/${quizId}?_=${Date.now()}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { events: [] }
      ),
    ]).then(([quizData, eventsData]) => {
      setQuiz(quizData);
      setEvents(eventsData.events ?? []);
      setLoading(false);
    });
  }, [quizId]);

  useEffect(() => {
    if (initialEventSlug) {
      setEventSlug(initialEventSlug);
    }
  }, [initialEventSlug]);

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

  const slides = useMemo(
    () => (quiz?.questions?.length ? buildPresentationSlides(quiz.questions) : []),
    [quiz?.questions]
  );

  const selectedEvent = events.find((event) => event.slug === eventSlug);
  const eventRules = selectedEvent?.rules?.filter(Boolean) ?? [];
  const venueName = selectedEvent ? `${selectedEvent.venue} · ${selectedEvent.city}` : "";
  const slide = slides[index];
  const progress = slides.length ? ((index + 1) / slides.length) * 100 : 0;
  const isQuestionPhase = slide?.type === "question_phase";
  const isCorrectionPhase = slide?.type === "correction";
  const showSlideTimer = isQuestionPhase || isCorrectionPhase;
  const slideTimerKey = isQuestionPhase
    ? slide.question.id
    : isCorrectionPhase
      ? `correction-${slide.roundNumber}-${index}`
      : null;

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

  const applyWizardStepPrefill = useCallback(
    (stepIndex: number, hints: QuizEvent[], saved: { venue: string; atLocal: string }[]) => {
      const hint = hints[stepIndex];
      if (hint) {
        setNextQuizDraftVenue(hint.venue);
        const local = eventToDatetimeLocalValue(hint);
        setNextQuizDraftAtLocal(local ?? toDatetimeLocalValue(defaultNextQuizDate()));
        return;
      }
      const lastSaved = saved[saved.length - 1];
      const prevAt = lastSaved
        ? parseDatetimeLocalValue(lastSaved.atLocal) ?? defaultNextQuizDate()
        : defaultNextQuizDate();
      setNextQuizDraftVenue("");
      setNextQuizDraftAtLocal(toDatetimeLocalValue(defaultNextQuizDateAfter(prevAt, 1)));
    },
    []
  );

  const stepsToFormattedLines = useCallback((steps: { venue: string; atLocal: string }[]) => {
    return formatNextQuizLines(
      steps
        .filter((row) => row.venue.trim())
        .map((row) => ({
          venue: row.venue,
          at: parseDatetimeLocalValue(row.atLocal) ?? defaultNextQuizDate(),
        }))
    );
  }, []);

  const finishNextQuizWizard = useCallback(
    (steps: { venue: string; atLocal: string }[]) => {
      setNextQuizLines(stepsToFormattedLines(steps));
      setShowNextQuizModal(false);
      setSavedNextQuizSteps([]);
      setNextQuizWizardIndex(0);
      setStarted(true);
    },
    [stepsToFormattedLines]
  );

  const openNextQuizModal = useCallback(() => {
    const hints = getUpcomingQuizEvents(events, MAX_NEXT_QUIZ_LINES);
    setUpcomingEventHints(hints);
    setSavedNextQuizSteps([]);
    setNextQuizWizardIndex(0);
    if (hints.length > 0) {
      applyWizardStepPrefill(0, hints, []);
    } else {
      const current = events.find((event) => event.slug === eventSlug);
      setNextQuizDraftVenue(current?.venue ?? "");
      const local = current ? eventToDatetimeLocalValue(current) : null;
      setNextQuizDraftAtLocal(local ?? toDatetimeLocalValue(defaultNextQuizDate()));
    }
    setShowNextQuizModal(true);
  }, [applyWizardStepPrefill, events, eventSlug]);

  const confirmStartPresentation = useCallback(() => {
    const steps = [...savedNextQuizSteps];
    if (nextQuizDraftVenue.trim()) {
      steps.push({ venue: nextQuizDraftVenue.trim(), atLocal: nextQuizDraftAtLocal });
    }
    finishNextQuizWizard(steps);
  }, [finishNextQuizWizard, nextQuizDraftAtLocal, nextQuizDraftVenue, savedNextQuizSteps]);

  const goNextQuizWizardStep = useCallback(() => {
    if (!nextQuizDraftVenue.trim()) return;
    const nextSaved = [
      ...savedNextQuizSteps,
      { venue: nextQuizDraftVenue.trim(), atLocal: nextQuizDraftAtLocal },
    ];
    if (nextSaved.length >= MAX_NEXT_QUIZ_LINES) {
      finishNextQuizWizard(nextSaved);
      return;
    }
    setSavedNextQuizSteps(nextSaved);
    const nextIndex = nextSaved.length;
    setNextQuizWizardIndex(nextIndex);
    applyWizardStepPrefill(nextIndex, upcomingEventHints, nextSaved);
  }, [
    applyWizardStepPrefill,
    finishNextQuizWizard,
    nextQuizDraftAtLocal,
    nextQuizDraftVenue,
    savedNextQuizSteps,
    upcomingEventHints,
  ]);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleStageClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) goPrev();
      else goNext();
    },
    [goNext, goPrev]
  );

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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, started, toggleFullscreen]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#060606] flex items-center justify-center text-white/70">
        Načítavam…
      </div>
    );
  }

  if (!slides.length) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#060606] flex flex-col items-center justify-center gap-4 text-white">
        <p>Žiadne otázky. Doplň ich v editore.</p>
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
            className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowNextQuizModal(false)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl border border-white/15 bg-[#121212] p-6 sm:p-8 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="text-[#f0c800]/80 text-xs uppercase tracking-[0.25em] mb-2">Pred projekciou</p>
                <h2 className="font-display text-2xl tracking-wide">Najbližšie kvízy</h2>
                <p className="text-white/50 text-sm mt-2">
                  Zobrazia sa na slidoch „Opravovanie“. Môžeš pridať až {MAX_NEXT_QUIZ_LINES} termínov — každý
                  potvrď „Ďalší termín“, na záver „Spustiť projekciu“.
                </p>
                <p className="text-[#f0c800]/90 text-xs font-semibold mt-3">
                  Termín {Math.min(nextQuizWizardIndex + 1, MAX_NEXT_QUIZ_LINES)} / {MAX_NEXT_QUIZ_LINES}
                </p>
              </div>
              {savedNextQuizSteps.length > 0 && (
                <ul className="text-xs text-white/55 space-y-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                  {stepsToFormattedLines(savedNextQuizSteps).map((line) => (
                    <li key={line}>✓ {line}</li>
                  ))}
                </ul>
              )}
              <label className="block space-y-2">
                <span className="text-sm text-white/70">Podnik / miesto</span>
                <input
                  type="text"
                  value={nextQuizDraftVenue}
                  onChange={(e) => setNextQuizDraftVenue(e.target.value)}
                  placeholder="napr. Alipub"
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-white/35"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-white/70">Dátum a čas</span>
                <input
                  type="datetime-local"
                  value={nextQuizDraftAtLocal}
                  onChange={(e) => setNextQuizDraftAtLocal(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white [color-scheme:dark]"
                />
              </label>
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNextQuizModal(false)}
                    className="flex-1 rounded-xl border border-white/20 py-3 text-white/80 hover:bg-white/10 transition-colors"
                  >
                    Zrušiť
                  </button>
                  {savedNextQuizSteps.length + 1 < MAX_NEXT_QUIZ_LINES ? (
                    <button
                      type="button"
                      disabled={!nextQuizDraftVenue.trim()}
                      onClick={goNextQuizWizardStep}
                      className="flex-1 rounded-xl border border-[#f0c800]/50 py-3 text-[#f0c800] font-semibold hover:bg-[#f0c800]/10 transition-colors disabled:opacity-40"
                    >
                      Ďalší termín
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={confirmStartPresentation}
                  className="w-full rounded-xl bg-[#f0c800] text-black font-bold py-3 hover:bg-[#ffd54f] transition-colors"
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

  return (
    <div ref={rootRef} className="fixed inset-0 z-[9999] bg-[#030303] flex items-center justify-center overflow-hidden">
      <div
        className="relative text-white flex flex-col select-none overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
        style={stageStyle}
        onContextMenu={(e) => {
          e.preventDefault();
          goPrev();
        }}
        role="presentation"
      >
        <SlideBackdrop />

      {!isFullscreen && (
        <div className="absolute top-0 inset-x-0 flex items-center justify-end p-4 sm:p-5 z-20">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p-2.5 rounded-full bg-black/40 border border-white/15 hover:bg-white/15 backdrop-blur-sm transition-colors"
              title="Celá obrazovka"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            <Link
              href={`/admin/hotove-kvizy/${quizId}`}
              className="p-2.5 rounded-full bg-black/40 border border-white/15 hover:bg-white/15 backdrop-blur-sm transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <X className="w-5 h-5" />
            </Link>
          </div>
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
              {activeQuestion.questionNumber}
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
        className="relative z-[2] flex-1 flex min-h-0 w-full"
        innerClassName="min-h-0"
        onBackgroundClick={handleStageClick}
      >
        <PresentationStageAutoFit enabled={questionAutoFit} slideKey={slideKey} className={SLIDE_SAFE_AREA_CLASS}>
          {slide && (
            <div className="w-full min-h-0 max-h-full flex flex-col items-center justify-center overflow-visible">
              <PresentationView
                slide={slide}
                eventRules={eventRules}
                venueName={venueName}
                nextQuizLines={nextQuizLines}
              />
            </div>
          )}
        </PresentationStageAutoFit>
      </PresentationZoomLayer>

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
