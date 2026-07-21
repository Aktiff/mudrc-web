"use client";

import { useEffect } from "react";
import { trackViewQuiz } from "@/lib/analytics";

type Props = {
  eventSlug: string;
  venue: string;
};

export default function QuizViewTracker({ eventSlug, venue }: Props) {
  useEffect(() => {
    trackViewQuiz({ eventSlug, venue });
  }, [eventSlug, venue]);

  return null;
}
