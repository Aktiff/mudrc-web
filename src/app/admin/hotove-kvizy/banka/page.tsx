"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, ChevronLeft } from "lucide-react";
import CustomBankQuestionForm from "@/components/CustomBankQuestionForm";
import MusicBankQuestionForm from "@/components/MusicBankQuestionForm";
import QuestionBankInventory from "@/components/QuestionBankInventory";
import SoundBankQuestionForm from "@/components/SoundBankQuestionForm";
import VideoBankQuestionForm from "@/components/VideoBankQuestionForm";

export default function HotoveKvizyBankaPage() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = () => setRefreshKey((v) => v + 1);

  const addForms = (
    <div className="space-y-4 min-w-0 max-w-full">
      <h2 className="font-display text-xl text-brand-text tracking-wide">Pridať do banky</h2>
      <CustomBankQuestionForm onAdded={bump} />
      <MusicBankQuestionForm onAdded={bump} onMessage={(text, ok) => setMsg({ text, ok })} />
      <SoundBankQuestionForm onAdded={bump} onMessage={(text, ok) => setMsg({ text, ok })} />
      <VideoBankQuestionForm onAdded={bump} onMessage={(text, ok) => setMsg({ text, ok })} />
    </div>
  );

  const inventory = <QuestionBankInventory refreshKey={refreshKey} onChanged={bump} fillHeight />;

  return (
    <div className="min-w-0 max-w-full space-y-6 pb-6">
      <Link
        href="/admin/hotove-kvizy"
        className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-orange-readable"
      >
        <ChevronLeft className="w-4 h-4" />
        Späť na hotové kvízy
      </Link>

      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-brand-orange" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Banka otázok</h1>
          <p className="text-brand-muted text-sm leading-relaxed max-w-3xl">
            Vľavo pridávaš otázky a médiá, vpravo prehľad a úpravy. V editore kvízu vkladáš z banky do slotov.
          </p>
        </div>
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0 max-w-full items-start">
        <div className="min-w-0 max-w-full">{addForms}</div>
        <div className="min-w-0 max-w-full lg:sticky lg:top-24 lg:self-start lg:z-20 lg:h-[calc(100vh-7rem)]">
          {inventory}
        </div>
      </div>
    </div>
  );
}
