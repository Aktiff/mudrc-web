"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import type { QuizLibraryItem, QuizSlide } from "@/lib/quiz-library";

type Props = {
  quizId: string;
  initialEventSlug?: string;
};

function RulesSlide({ rules }: { rules: string[] }) {
  return (
    <div className="w-full max-w-4xl px-8">
      <p className="text-[#f0c800] text-xl sm:text-2xl uppercase tracking-[0.25em] mb-8 text-center font-semibold">
        Pravidlá
      </p>
      <ul className="space-y-4 text-left">
        {rules.map((rule, index) => (
          <li key={index} className="flex gap-4 text-xl sm:text-2xl text-white leading-snug">
            <span className="text-[#f0c800] font-display text-3xl shrink-0">{index + 1}.</span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SlideView({
  slide,
  eventRules,
  venueName,
}: {
  slide: QuizSlide;
  eventRules: string[];
  venueName: string;
}) {
  if (slide.type === "rules") {
    const rules = eventRules.length ? eventRules : [slide.body || "Pravidlá doplníte v admin → Udalosť → Pravidlá."];
    return (
      <div className="flex flex-col items-center gap-6 w-full">
        {venueName && <p className="text-white/50 text-lg">{venueName}</p>}
        <RulesSlide rules={rules} />
      </div>
    );
  }

  if (slide.type === "title") {
    return (
      <div className="text-center px-8 max-w-5xl">
        <p className="font-display text-6xl sm:text-8xl md:text-9xl text-white tracking-wide leading-none">
          {slide.title || "MUDRC KVÍZ"}
        </p>
        {slide.subtitle && (
          <p className="text-2xl sm:text-4xl text-[#f0c800] mt-8 font-semibold">{slide.subtitle}</p>
        )}
      </div>
    );
  }

  if (slide.type === "round") {
    return (
      <div className="text-center px-8">
        <p className="text-[#f0c800] text-xl sm:text-2xl uppercase tracking-[0.3em] mb-4">
          Kolo {slide.roundNumber ?? ""}
        </p>
        <p className="font-display text-6xl sm:text-8xl text-white tracking-wide">{slide.title || "Kolo"}</p>
        {slide.subtitle && <p className="text-2xl sm:text-3xl text-white/75 mt-6">{slide.subtitle}</p>}
      </div>
    );
  }

  if (slide.type === "correction") {
    return (
      <div className="text-center px-8 max-w-4xl">
        <p className="font-display text-7xl sm:text-9xl text-[#f0c800] tracking-wide mb-6">Opravovanie</p>
        <p className="text-2xl sm:text-4xl text-white/85 whitespace-pre-wrap">{slide.body}</p>
      </div>
    );
  }

  if (slide.type === "question" || slide.type === "music") {
    const isMusic = slide.type === "music";
    return (
      <div className="w-full max-w-6xl px-6 sm:px-10 flex flex-col items-center gap-8">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {slide.title && (
            <p className="text-[#f0c800] text-lg sm:text-xl font-semibold uppercase tracking-wider">{slide.title}</p>
          )}
          {isMusic && (
            <span className="text-xs font-bold uppercase tracking-wider bg-purple-500/30 text-purple-200 px-3 py-1 rounded-full">
              Hudobná ukážka
            </span>
          )}
        </div>
        {slide.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageUrl} alt="" className="max-h-[35vh] max-w-full rounded-2xl object-contain shadow-2xl" />
        )}
        {isMusic && slide.audioUrl && (
          <audio controls src={slide.audioUrl} className="w-full max-w-xl" onClick={(e) => e.stopPropagation()} />
        )}
        <p className="font-display text-3xl sm:text-5xl md:text-6xl text-white text-center leading-tight tracking-wide whitespace-pre-wrap">
          {slide.body || (isMusic ? "Sem daj odkaz na ukážku alebo popis…" : "Otázka")}
        </p>
      </div>
    );
  }

  if (slide.type === "answer") {
    return (
      <div className="w-full max-w-6xl px-6 sm:px-10 flex flex-col items-center gap-6">
        {slide.title && (
          <p className="text-[#f0c800] text-lg sm:text-xl font-semibold uppercase tracking-wider">{slide.title}</p>
        )}
        {slide.body && (
          <p className="text-2xl sm:text-3xl text-white/70 text-center whitespace-pre-wrap max-w-4xl">{slide.body}</p>
        )}
        <div className="px-8 py-5 rounded-2xl bg-[#f0c800] text-black text-center max-w-4xl w-full">
          <p className="text-sm uppercase tracking-wider font-bold mb-1 opacity-70">Správna odpoveď</p>
          <p className="text-2xl sm:text-4xl font-display tracking-wide">{slide.answer || "—"}</p>
        </div>
      </div>
    );
  }

  if (slide.type === "scores") {
    return (
      <div className="text-center px-8 max-w-4xl">
        <p className="font-display text-6xl sm:text-8xl text-white tracking-wide mb-6">{slide.title || "Vyhodnotenie"}</p>
        <p className="text-xl sm:text-2xl text-white/80 whitespace-pre-wrap">{slide.body}</p>
      </div>
    );
  }

  return (
    <div className="text-center px-8 max-w-4xl">
      {slide.title && <p className="font-display text-5xl sm:text-7xl text-white tracking-wide mb-6">{slide.title}</p>}
      <p className="text-xl sm:text-3xl text-white/90 whitespace-pre-wrap leading-relaxed">{slide.body}</p>
    </div>
  );
}

function slideHint(slide: QuizSlide | undefined): string {
  if (!slide) return "";
  if (slide.type === "question" || slide.type === "music") return "Otázky — ďalší slide (odpovede až v sekcii správnych odpovedí)";
  if (slide.type === "correction") return "Čas na opravu — ďalší slide";
  return "Klik / medzerník = ďalší slide";
}

export default function QuizLibraryShow({ quizId, initialEventSlug = "" }: Props) {
  const [quiz, setQuiz] = useState<QuizLibraryItem | null>(null);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [eventSlug, setEventSlug] = useState(initialEventSlug);
  const [started, setStarted] = useState(Boolean(initialEventSlug));
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

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
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  const selectedEvent = events.find((event) => event.slug === eventSlug);
  const eventRules = selectedEvent?.rules?.filter(Boolean) ?? [];
  const venueName = selectedEvent ? `${selectedEvent.venue} · ${selectedEvent.city}` : "";

  const slide = quiz?.slides[index];

  const goNext = useCallback(() => {
    if (!quiz) return;
    setIndex((i) => Math.min(quiz.slides.length - 1, i + 1));
  }, [quiz]);

  const goPrev = useCallback(() => {
    if (!quiz) return;
    setIndex((i) => Math.max(0, i - 1));
  }, [quiz]);

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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, started]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center text-white/70">
        Načítavam…
      </div>
    );
  }

  if (!quiz?.slides.length) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center gap-4 text-white">
        <p>Žiadne slidy. Najprv vygeneruj štruktúru v editore.</p>
        <Link href={`/admin/hotove-kvizy/${quizId}`} className="text-[#f0c800] underline">
          Späť do editora
        </Link>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="font-display text-3xl tracking-wide mb-2">{quiz.title}</h1>
            <p className="text-white/60 text-sm">Vyber podnik — prvý slide zobrazí jeho pravidlá.</p>
          </div>
          <select
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white"
            value={eventSlug}
            onChange={(e) => setEventSlug(e.target.value)}
          >
            <option value="" className="text-black">
              — Vyber podnik —
            </option>
            {events.map((event) => (
              <option key={event.slug} value={event.slug} className="text-black">
                {event.venue} · {event.city}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!eventSlug}
            onClick={() => setStarted(true)}
            className="w-full rounded-xl bg-[#f0c800] text-black font-bold py-3 disabled:opacity-40"
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

  return (
    <div
      className="fixed inset-0 bg-[#0a0a0a] text-white flex flex-col select-none cursor-pointer"
      onClick={goNext}
      role="presentation"
    >
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 sm:p-6 z-20 pointer-events-none">
        <span className="text-white/40 text-sm font-mono">
          {index + 1} / {quiz.slides.length}
          {venueName && <span className="hidden sm:inline ml-3">{venueName}</span>}
        </span>
        <Link
          href={`/admin/hotove-kvizy/${quizId}`}
          className="pointer-events-auto p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <X className="w-5 h-5" />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 py-16">
        {slide && <SlideView slide={slide} eventRules={eventRules} venueName={venueName} />}
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 flex items-center justify-between z-20 pointer-events-none">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={index === 0}
          className="pointer-events-auto p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <p className="text-white/35 text-xs sm:text-sm text-center max-w-md">{slideHint(slide)}</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          disabled={index >= quiz.slides.length - 1}
          className="pointer-events-auto p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
