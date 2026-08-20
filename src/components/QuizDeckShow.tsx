"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { QuizDeck, QuizSlide } from "@/lib/quiz-deck";

type Props = {
  eventSlug: string;
};

function SlideView({ slide, answerRevealed }: { slide: QuizSlide; answerRevealed: boolean }) {
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
        <p className="text-[#f0c800] text-xl sm:text-2xl uppercase tracking-[0.3em] mb-4">Kolo {slide.roundNumber ?? ""}</p>
        <p className="font-display text-6xl sm:text-8xl text-white tracking-wide">{slide.title || "Kolo"}</p>
      </div>
    );
  }

  if (slide.type === "question") {
    return (
      <div className="w-full max-w-6xl px-6 sm:px-10 flex flex-col items-center gap-8">
        {slide.title && <p className="text-[#f0c800] text-lg sm:text-xl font-semibold uppercase tracking-wider">{slide.title}</p>}
        {slide.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageUrl} alt="" className="max-h-[40vh] max-w-full rounded-2xl object-contain shadow-2xl" />
        )}
        <p className="font-display text-3xl sm:text-5xl md:text-6xl text-white text-center leading-tight tracking-wide whitespace-pre-wrap">
          {slide.body || "Otázka"}
        </p>
        {answerRevealed && slide.answer && (
          <div className="mt-4 px-8 py-5 rounded-2xl bg-[#f0c800] text-black text-center max-w-4xl">
            <p className="text-sm uppercase tracking-wider font-bold mb-1 opacity-70">Odpoveď</p>
            <p className="text-2xl sm:text-4xl font-display tracking-wide">{slide.answer}</p>
          </div>
        )}
      </div>
    );
  }

  if (slide.type === "scores") {
    return (
      <div className="text-center px-8 max-w-4xl">
        <p className="font-display text-6xl sm:text-8xl text-white tracking-wide mb-6">{slide.title || "Výsledky"}</p>
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

export default function QuizDeckShow({ eventSlug }: Props) {
  const [deck, setDeck] = useState<QuizDeck | null>(null);
  const [index, setIndex] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/events/${eventSlug}/deck?_=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        setDeck(data);
        setLoading(false);
      });
  }, [eventSlug]);

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

  const slide = deck?.slides[index];
  const isQuestion = slide?.type === "question" && Boolean(slide.answer?.trim());

  const goNext = useCallback(() => {
    if (!deck) return;
    if (isQuestion && !answerRevealed) {
      setAnswerRevealed(true);
      return;
    }
    setAnswerRevealed(false);
    setIndex((i) => Math.min(deck.slides.length - 1, i + 1));
  }, [deck, isQuestion, answerRevealed]);

  const goPrev = useCallback(() => {
    if (!deck) return;
    setAnswerRevealed(false);
    setIndex((i) => Math.max(0, i - 1));
  }, [deck]);

  useEffect(() => {
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
  }, [goNext, goPrev]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center text-white/70">
        Načítavam…
      </div>
    );
  }

  if (!deck?.slides.length) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center gap-4 text-white">
        <p>Žiadne slidy. Najprv ich vytvor v editore.</p>
        <Link href={`/admin/udalosti/${eventSlug}/prezentacia-kvizu`} className="text-[#f0c800] underline">
          Späť do editora
        </Link>
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
          {index + 1} / {deck.slides.length}
        </span>
        <Link
          href={`/admin/udalosti/${eventSlug}/prezentacia-kvizu`}
          className="pointer-events-auto p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <X className="w-5 h-5" />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 py-16">
        {slide && <SlideView slide={slide} answerRevealed={answerRevealed} />}
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
        <p className="text-white/35 text-xs sm:text-sm text-center max-w-md">
          {isQuestion && !answerRevealed ? "Klik / medzerník = odhaliť odpoveď" : "Klik / medzerník = ďalší slide"}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          disabled={index >= deck.slides.length - 1 && (!isQuestion || answerRevealed)}
          className="pointer-events-auto p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
