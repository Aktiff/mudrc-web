"use client";

import { Suspense } from "react";
import QuizLibraryShow from "@/components/QuizLibraryShow";
import { useSearchParams } from "next/navigation";

function QuizLibraryShowInner({ quizId }: { quizId: string }) {
  const searchParams = useSearchParams();
  const eventSlug = searchParams.get("event") ?? "";
  return <QuizLibraryShow quizId={quizId} initialEventSlug={eventSlug} />;
}

export default function QuizLibraryShowPageClient({ quizId }: { quizId: string }) {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center text-white/70">Načítavam…</div>
      }
    >
      <QuizLibraryShowInner quizId={quizId} />
    </Suspense>
  );
}
