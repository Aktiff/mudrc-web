"use client";

import { useEffect, useMemo, useState } from "react";
import { finishCustomQuizType, quizTypeOrDefault, rememberQuizTypes } from "@/lib/quiz-type";

const OTHER = "__ine__";

export default function QuizTypeField({
  id,
  value,
  onChange,
  knownTypes,
  onRemember,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  knownTypes: string[];
  onRemember?: (value: string) => void;
}) {
  const [extras, setExtras] = useState<string[]>([]);
  const [pickingOther, setPickingOther] = useState(false);
  const [userPickedOther, setUserPickedOther] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const options = useMemo(() => rememberQuizTypes([...knownTypes, ...extras]), [knownTypes, extras]);
  const selected = quizTypeOrDefault(value);
  const match = options.find((type) => type.toLocaleLowerCase("sk") === selected.toLocaleLowerCase("sk")) ?? "";

  useEffect(() => {
    if (userPickedOther) return;
    if (match) {
      setPickingOther(false);
      return;
    }
    const current = String(value ?? "").trim();
    if (!current) return;
    setDraft(quizTypeOrDefault(current));
    setDraftDirty(false);
    setPickingOther(true);
  }, [userPickedOther, match, value]);

  const commitDraft = () => {
    const finished = finishCustomQuizType(draft);
    if (!finished || !draftDirty) return;
    setExtras((current) => {
      const key = finished.toLocaleLowerCase("sk");
      if (current.some((type) => type.toLocaleLowerCase("sk") === key)) return current;
      if (knownTypes.some((type) => type.toLocaleLowerCase("sk") === key)) return current;
      return [...current, finished];
    });
    setUserPickedOther(false);
    setPickingOther(false);
    setDraft("");
    setDraftDirty(false);
    onChange(finished);
    onRemember?.(finished);
  };

  return (
    <div className="space-y-2">
      <select
        id={id}
        className="input"
        value={pickingOther || !match ? OTHER : match}
        onChange={(event) => {
          if (event.target.value === OTHER) {
            setDraft("");
            setDraftDirty(false);
            setUserPickedOther(true);
            setPickingOther(true);
            return;
          }
          setUserPickedOther(false);
          setPickingOther(false);
          setDraft("");
          setDraftDirty(false);
          onChange(event.target.value);
        }}
      >
        {options.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
        <option value={OTHER}>Iné</option>
      </select>
      {pickingOther || !match ? (
        <>
          <input
            className="input"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setDraftDirty(true);
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
              }
            }}
            placeholder="Napríklad seriálový"
            aria-label="Vlastný typ kvízu"
          />
          <p className="text-brand-muted text-xs">Po kliknutí mimo poľa sa uloží ako typ, napríklad Seriálový kvíz.</p>
        </>
      ) : null}
    </div>
  );
}
