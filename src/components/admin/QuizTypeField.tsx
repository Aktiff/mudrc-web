"use client";

import { quizTypeOrDefault } from "@/lib/quiz-type";

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
  const selected = quizTypeOrDefault(value);
  const selectedKey = selected.toLocaleLowerCase("sk");
  const options = knownTypes.some((type) => type.toLocaleLowerCase("sk") === selectedKey)
    ? knownTypes
    : [selected, ...knownTypes];

  return (
    <select
      id={id}
      className="input"
      value={options.find((type) => type.toLocaleLowerCase("sk") === selectedKey) ?? selected}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </select>
  );
}
