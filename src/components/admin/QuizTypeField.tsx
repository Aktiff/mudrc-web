"use client";

import { normalizeQuizTypeLabel } from "@/lib/quiz-type";

export default function QuizTypeField({
  id,
  value,
  onChange,
  knownTypes,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  knownTypes: string[];
}) {
  return (
    <>
      <input
        className="input"
        list={id}
        value={value}
        placeholder="Všeobecný kvíz"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const next = normalizeQuizTypeLabel(value);
          if (next && next !== value) onChange(next);
        }}
      />
      <datalist id={id}>
        {knownTypes.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
    </>
  );
}
