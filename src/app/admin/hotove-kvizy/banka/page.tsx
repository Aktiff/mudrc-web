"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, ChevronLeft } from "lucide-react";
import CustomBankQuestionForm from "@/components/CustomBankQuestionForm";
import SoundBankQuestionForm from "@/components/SoundBankQuestionForm";
import VideoBankQuestionForm from "@/components/VideoBankQuestionForm";

export default function HotoveKvizyBankaPage() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 pb-4">
      <Link
        href="/admin/hotove-kvizy"
        className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-orange-readable"
      >
        <ChevronLeft className="w-4 h-4" />
        Späť na hotové kvízy
      </Link>

      <div className="flex items-start gap-4 pb-1">
        <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-brand-orange" />
        </div>
        <div>
          <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Banka otázok</h1>
          <p className="text-brand-muted text-sm leading-relaxed">
            Sem pridávaj vlastné otázky, zvuk a video. V editore kvízu ich potom vložíš z pravej banky do slotov.
          </p>
        </div>
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
      )}

      <div className="space-y-6">
        <CustomBankQuestionForm />
        <SoundBankQuestionForm onMessage={(text, ok) => setMsg({ text, ok })} />
        <VideoBankQuestionForm onMessage={(text, ok) => setMsg({ text, ok })} />
      </div>
    </div>
  );
}
