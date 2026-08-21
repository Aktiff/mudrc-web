"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import type { QuizLibraryItem, QuizQuestionItem } from "@/lib/quiz-library";
import {
  buildPresentationSlides,
  shouldShowImageInAnswerPhase,
  shouldShowImageInQuestionPhase,
  type PresentationSlide,
} from "@/lib/quiz-presentation";
import { findCorrectOptionIndex, getQuestionBodyText, getQuestionOptions, optionLetter } from "@/lib/quiz-question-options";

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
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl px-8">
      {venueName && (
        <p className="text-[#f0c800]/70 text-lg sm:text-xl tracking-wide uppercase">{venueName}</p>
      )}
      <div className="w-16 h-1 rounded-full bg-gradient-to-r from-transparent via-[#f0c800] to-transparent" />
      <p className="text-[#f0c800] text-2xl sm:text-3xl uppercase tracking-[0.35em] font-semibold">Pravidlá</p>
      <ul className="space-y-4 w-full rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 sm:p-10">
        {rules.map((rule, index) => (
          <li key={index} className="flex gap-5 text-lg sm:text-2xl text-white/95 leading-snug">
            <span className="text-[#f0c800] font-display text-3xl sm:text-4xl shrink-0 w-8 text-right">{index + 1}</span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-[96vw] xl:max-w-[88rem]">
      {options.map((option, index) => {
        const isCorrect = index === highlightCorrectIndex;

        return (
          <div
            key={`${index}-${option}`}
            className={`flex items-center gap-5 sm:gap-6 min-h-[5.5rem] sm:min-h-[7rem] md:min-h-[8.5rem] px-6 sm:px-8 md:px-10 py-5 sm:py-6 md:py-7 rounded-2xl border-2 shadow-[0_12px_48px_rgba(0,0,0,0.45)] ${
              isCorrect
                ? "border-[#f0c800] bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black ring-4 ring-[#f0c800]/35"
                : "border-white/20 bg-white/[0.06] backdrop-blur-sm text-white"
            }`}
          >
            <span
              className={`font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-none shrink-0 w-14 sm:w-16 md:w-20 text-left ${
                isCorrect ? "text-black/70" : "text-[#f0c800]"
              }`}
            >
              {optionLetter(index)})
            </span>
            <p
              className={`flex-1 font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-wide leading-snug text-left ${
                isCorrect ? "font-bold" : ""
              }`}
            >
              {option}
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
  const questionText = getQuestionBodyText(question) || "Otázka";
  const options = getQuestionOptions(question);
  const correctOptionIndex =
    phase === "answer" ? findCorrectOptionIndex(options, question.answer) : -1;

  return (
    <div className="w-full max-w-[96vw] xl:max-w-[88rem] px-4 sm:px-8 flex flex-col items-center gap-8 sm:gap-10 md:gap-12">
      {phase === "question" && question.kind === "music" && question.audioUrl?.trim() && (
        <audio
          controls
          src={question.audioUrl}
          className="w-full max-w-xl"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        />
      )}

      {showImage && question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.imageUrl}
          alt=""
          className="max-h-[30vh] max-w-full rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
        />
      )}

      <p className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[6.5rem] text-white text-center leading-[1.05] tracking-wide whitespace-pre-wrap drop-shadow-lg px-2">
        {questionText}
      </p>

      {options.length > 0 && (
        <OptionsGrid options={options} highlightCorrectIndex={correctOptionIndex} />
      )}

      {phase === "answer" && options.length > 0 && correctOptionIndex < 0 && question.answer.trim() && (
        <div className="px-10 sm:px-14 py-8 sm:py-10 rounded-2xl bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black text-center max-w-5xl w-full shadow-[0_20px_60px_rgba(240,200,0,0.25)]">
          <p className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-display tracking-wide">{question.answer}</p>
        </div>
      )}

      {phase === "answer" && options.length === 0 && (
        <div className="px-10 sm:px-14 py-8 sm:py-10 rounded-2xl bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black text-center max-w-5xl w-full shadow-[0_20px_60px_rgba(240,200,0,0.25)]">
          <p className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-display tracking-wide">{question.answer || "—"}</p>
        </div>
      )}
    </div>
  );
}

function PresentationView({
  slide,
  eventRules,
  venueName,
}: {
  slide: PresentationSlide;
  eventRules: string[];
  venueName: string;
}) {
  if (slide.type === "rules") {
    const rules = eventRules.length ? eventRules : ["Pravidlá nastav v admin → Udalosť → Pravidlá."];
    return <RulesSlide rules={rules} venueName={venueName} />;
  }
  if (slide.type === "round") {
    return (
      <div className="text-center px-8">
        <p className="font-display text-7xl sm:text-9xl md:text-[10rem] text-white tracking-wide leading-none">
          {slide.title}
        </p>
        {slide.subtitle && <p className="text-xl sm:text-3xl text-white/65 mt-8 font-medium">{slide.subtitle}</p>}
      </div>
    );
  }
  if (slide.type === "correction") {
    return (
      <div className="text-center px-8 max-w-4xl">
        <p className="font-display text-7xl sm:text-9xl text-[#f0c800] tracking-wide mb-8">Opravovanie</p>
        <p className="text-2xl sm:text-4xl text-white/85 leading-relaxed">{slide.body}</p>
      </div>
    );
  }
  if (slide.type === "answers_intro") {
    return (
      <div className="text-center px-8">
        <div className="w-24 h-1 mx-auto rounded-full bg-[#f0c800] mb-8" />
        <p className="font-display text-5xl sm:text-7xl md:text-8xl text-white tracking-wide">{slide.title}</p>
      </div>
    );
  }
  if (slide.type === "question_phase") {
    return <QuestionContent question={slide.question} phase="question" />;
  }
  if (slide.type === "answer_phase") {
    return <QuestionContent question={slide.question} phase="answer" />;
  }
  return (
    <div className="text-center px-8 max-w-4xl">
      <p className="font-display text-6xl sm:text-8xl text-white tracking-wide mb-6">{slide.title}</p>
      <p className="text-xl sm:text-2xl text-white/80 whitespace-pre-wrap leading-relaxed">{slide.body}</p>
    </div>
  );
}

export default function QuizLibraryShow({ quizId, initialEventSlug = "" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [quiz, setQuiz] = useState<QuizLibraryItem | null>(null);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [eventSlug, setEventSlug] = useState(initialEventSlug);
  const [started, setStarted] = useState(Boolean(initialEventSlug));
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      setStarted(true);
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
  const questionTimerKey = isQuestionPhase ? slide.question.id : null;

  const [questionElapsed, setQuestionElapsed] = useState(0);

  useEffect(() => {
    if (!started || !questionTimerKey) {
      setQuestionElapsed(0);
      return;
    }

    setQuestionElapsed(0);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setQuestionElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [questionTimerKey, started]);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
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
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="w-full rounded-xl bg-[#f0c800] text-black font-bold py-3.5 hover:bg-[#ffd54f] transition-colors"
          >
            Spustiť projekciu
          </button>
          <Link href={`/admin/hotove-kvizy/${quizId}`} className="block text-center text-white/50 text-sm hover:text-white">
            Späť do editora
          </Link>
        </div>
      </div>
    );
  }

  const activeQuestion =
    slide?.type === "question_phase" || slide?.type === "answer_phase" ? slide.question : null;
  const showQuestionBadge = slide?.type === "question_phase";

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[9999] text-white flex flex-col select-none cursor-pointer overflow-hidden"
      onClick={goNext}
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
        <div className="absolute top-4 sm:top-5 left-4 sm:left-5 z-10 pointer-events-none">
          <div className="size-[4.75rem] sm:size-24 md:size-28 rounded-2xl bg-[#f0c800] shadow-[0_10px_40px_rgba(240,200,0,0.45)] ring-2 ring-[#f0c800]/40 flex items-center justify-center">
            <span className="font-display text-[3.25rem] sm:text-6xl md:text-7xl text-black tabular-nums leading-none [font-variant-numeric:tabular-nums]">
              {activeQuestion.questionNumber}
            </span>
          </div>
        </div>
      )}

      {isQuestionPhase && (
        <div className="absolute top-4 sm:top-5 right-4 sm:right-5 z-10 pointer-events-none">
          <div className="min-w-[4.75rem] sm:min-w-24 md:min-w-28 h-[4.75rem] sm:h-24 md:h-28 px-3 sm:px-4 rounded-2xl bg-black/80 border-2 border-white/30 backdrop-blur-sm shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center justify-center">
            <span className="font-mono text-[3.25rem] sm:text-6xl md:text-7xl font-bold text-white tabular-nums leading-none">
              {questionElapsed}
            </span>
          </div>
        </div>
      )}

      <div className="relative flex-1 flex items-center justify-center min-h-0 py-12 sm:py-16">
        {slide && <PresentationView slide={slide} eventRules={eventRules} venueName={venueName} />}
      </div>

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
  );
}
