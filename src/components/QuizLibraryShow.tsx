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

function questionTextScale(text: string): string {
  const len = text.length;
  if (len > 140) return "text-[clamp(1.75rem,3.6vmin,3.25rem)]";
  if (len > 100) return "text-[clamp(2rem,4.2vmin,4rem)]";
  if (len > 70) return "text-[clamp(2.25rem,5.2vmin,5.25rem)]";
  if (len > 45) return "text-[clamp(2.5rem,6.2vmin,6.5rem)]";
  return "text-[clamp(2.75rem,7.8vmin,9rem)]";
}

function OptionsGrid({
  options,
  highlightCorrectIndex = -1,
}: {
  options: string[];
  highlightCorrectIndex?: number;
}) {
  if (!options.length) return null;

  const rowCount = Math.ceil(options.length / 2);

  return (
    <div
      className="grid grid-cols-2 w-full flex-1 min-h-0 gap-[1.4vmin] auto-rows-fr"
      style={{ minHeight: `${Math.min(rowCount * 17, 58)}vmin` }}
    >
      {options.map((option, index) => {
        const isCorrect = index === highlightCorrectIndex;

        return (
          <div
            key={`${index}-${option}`}
            className={`flex items-center gap-[2vmin] min-h-[14vmin] px-[2.5vmin] py-[2vmin] rounded-2xl border-[0.25vmin] shadow-[0_12px_48px_rgba(0,0,0,0.45)] ${
              isCorrect
                ? "border-[#f0c800] bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black ring-[0.5vmin] ring-[#f0c800]/35"
                : "border-white/20 bg-white/[0.06] backdrop-blur-sm text-white"
            }`}
          >
            <span
              className={`font-display text-[clamp(2.25rem,6vmin,7.5rem)] leading-none shrink-0 w-[1.35em] text-left self-center ${
                isCorrect ? "text-black/70" : "text-[#f0c800]"
              }`}
            >
              {optionLetter(index)})
            </span>
            <p
              className={`flex-1 min-w-0 font-display text-[clamp(1.75rem,4.8vmin,6rem)] tracking-wide leading-[1.1] text-left self-center ${
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
    <div className="w-[90vw] h-[90vh] max-w-[90vw] max-h-[90vh] flex flex-col items-stretch justify-center gap-[2vh] min-h-0">
      {phase === "question" && question.kind === "music" && question.audioUrl?.trim() && (
        <audio
          controls
          src={question.audioUrl}
          className="w-full max-w-xl shrink-0"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        />
      )}

      {showImage && question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.imageUrl}
          alt=""
          className="max-h-[22vh] max-w-full rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10 shrink-0 mx-auto"
        />
      )}

      <p
        className={`${questionTextScale(questionText)} font-display text-white text-center leading-[1.08] tracking-wide whitespace-pre-wrap drop-shadow-lg shrink-0 px-[1vw]`}
      >
        {questionText}
      </p>

      {options.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col justify-center w-full">
          <OptionsGrid options={options} highlightCorrectIndex={correctOptionIndex} />
        </div>
      )}

      {phase === "answer" && options.length > 0 && correctOptionIndex < 0 && question.answer.trim() && (
        <div className="px-[3vmin] py-[2.5vmin] rounded-2xl bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black text-center w-full shrink-0 shadow-[0_20px_60px_rgba(240,200,0,0.25)]">
          <p className="text-[clamp(2rem,6vmin,7rem)] font-display tracking-wide">{question.answer}</p>
        </div>
      )}

      {phase === "answer" && options.length === 0 && (
        <div className="px-[3vmin] py-[2.5vmin] rounded-2xl bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black text-center w-full shrink-0 shadow-[0_20px_60px_rgba(240,200,0,0.25)]">
          <p className="text-[clamp(2rem,6vmin,7rem)] font-display tracking-wide">{question.answer || "—"}</p>
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

      <div className="relative flex-1 flex items-center justify-center min-h-0 w-full px-[5vw] py-[2vh]">
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
