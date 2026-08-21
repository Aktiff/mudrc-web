"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import type { QuizLibraryItem, QuizQuestionItem } from "@/lib/quiz-library";
import {
  buildPresentationSlides,
  shouldShowImageInAnswerPhase,
  shouldShowImageInQuestionPhase,
  type PresentationSlide,
} from "@/lib/quiz-presentation";

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

function QuestionContent({
  question,
  phase,
}: {
  question: QuizQuestionItem;
  phase: "question" | "answer";
}) {
  const showImage =
    phase === "question" ? shouldShowImageInQuestionPhase(question) : shouldShowImageInAnswerPhase(question);

  return (
    <div className="w-full max-w-6xl px-6 sm:px-10 flex flex-col items-center gap-6 sm:gap-8">
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
          className="max-h-[36vh] max-w-full rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
        />
      )}

      <p className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-white text-center leading-tight tracking-wide whitespace-pre-wrap drop-shadow-lg">
        {question.body || "Otázka"}
      </p>

      {phase === "answer" && (
        <div className="px-8 sm:px-12 py-6 sm:py-8 rounded-2xl bg-gradient-to-br from-[#f0c800] to-[#e6b800] text-black text-center max-w-4xl w-full shadow-[0_20px_60px_rgba(240,200,0,0.25)]">
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] font-bold mb-2 opacity-60">Správna odpoveď</p>
          <p className="text-2xl sm:text-4xl md:text-5xl font-display tracking-wide">{question.answer || "—"}</p>
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
        <p className="text-[#f0c800]/80 text-lg sm:text-xl uppercase tracking-[0.4em] mb-6">Kolo {slide.roundNumber}</p>
        <div className="relative inline-block">
          <div className="absolute -inset-8 rounded-full border border-[#f0c800]/20 scale-110" />
          <div className="absolute -inset-16 rounded-full border border-[#f0c800]/10 scale-110" />
          <p className="relative font-display text-7xl sm:text-9xl md:text-[10rem] text-white tracking-wide leading-none">
            {slide.title}
          </p>
        </div>
        {slide.subtitle && <p className="text-xl sm:text-3xl text-white/70 mt-10 font-medium">{slide.subtitle}</p>}
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
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isFullscreen) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      setShowControls(true);
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      return;
    }
    setShowControls(false);
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [isFullscreen]);

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

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[9999] text-white flex flex-col select-none cursor-pointer overflow-hidden"
      onClick={goNext}
      onContextMenu={(e) => {
        e.preventDefault();
        goPrev();
      }}
      onMouseMove={revealControls}
      role="presentation"
    >
      <SlideBackdrop />

      <div
        className={`absolute top-0 inset-x-0 flex items-center justify-between p-4 sm:p-5 z-20 transition-opacity duration-300 ${
          isFullscreen && !showControls ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="pointer-events-none flex items-center gap-3">
          <span className="text-white/50 text-sm font-mono tabular-nums">
            {index + 1} / {slides.length}
          </span>
          {quiz?.title && (
            <span className="hidden sm:inline text-white/30 text-sm truncate max-w-[200px]">{quiz.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="p-2.5 rounded-full bg-black/40 border border-white/15 hover:bg-white/15 backdrop-blur-sm transition-colors"
            title={isFullscreen ? "Ukončiť celú obrazovku (Esc)" : "Celá obrazovka"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
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

      {activeQuestion && (
        <div
          className={`absolute top-16 sm:top-20 left-5 sm:left-8 z-10 pointer-events-none transition-opacity duration-300 ${
            isFullscreen && !showControls ? "opacity-40" : "opacity-100"
          }`}
        >
          <span className="font-display text-7xl sm:text-9xl text-[#f0c800]/20 leading-none tabular-nums">
            {activeQuestion.questionNumber}
          </span>
        </div>
      )}

      <div className="relative flex-1 flex items-center justify-center min-h-0 py-12 sm:py-16">
        {slide && <PresentationView slide={slide} eventRules={eventRules} venueName={venueName} />}
      </div>

      <div
        className={`absolute bottom-0 inset-x-0 z-20 transition-opacity duration-300 ${
          isFullscreen && !showControls ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="h-1 bg-white/10 mx-4 sm:mx-8 mb-4 sm:mb-5 rounded-full overflow-hidden pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-[#f0c800] to-[#ffd54f] transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
