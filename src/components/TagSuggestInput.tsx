"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTagsInput, parseTagsInput } from "@/lib/quiz-question-tags";
import {
  fetchUsedQuestionTags,
  peekUsedQuestionTags,
  rememberUsedQuestionTags,
  subscribeUsedQuestionTags,
} from "@/lib/used-question-tags-client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

function normalizeSearch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesSuggestion(query: string, suggestion: string): boolean {
  const normalizedQuery = normalizeSearch(query);
  const normalizedSuggestion = normalizeSearch(suggestion);
  if (!normalizedQuery) return false;
  if (normalizedSuggestion === normalizedQuery) return false;
  return normalizedSuggestion.startsWith(normalizedQuery) || normalizedSuggestion.includes(normalizedQuery);
}

function splitCurrentTag(draft: string): { prefix: string; query: string } {
  const index = Math.max(draft.lastIndexOf(","), draft.lastIndexOf(";"));
  if (index === -1) return { prefix: "", query: draft };
  return { prefix: draft.slice(0, index + 1), query: draft.slice(index + 1) };
}

function withSelectedTag(draft: string, tag: string): string {
  const { prefix } = splitCurrentTag(draft);
  if (!prefix) return tag;
  const head = /\s$/.test(prefix) ? prefix : `${prefix} `;
  return `${head}${tag}`;
}

export default function TagSuggestInput({ value, onChange, className, placeholder }: Props) {
  const [draft, setDraft] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const focused = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  useEffect(() => {
    void fetchUsedQuestionTags().then((tags) => setSuggestions(tags));
    return subscribeUsedQuestionTags(() => setSuggestions(peekUsedQuestionTags()));
  }, []);

  const { query } = splitCurrentTag(draft);
  const filtered = useMemo(() => {
    const typed = query.trim();
    if (!typed) return [];
    const used = new Set((parseTagsInput(splitCurrentTag(draft).prefix) ?? []).map((tag) => tag.toLowerCase()));
    return suggestions
      .filter((suggestion) => !used.has(suggestion.toLowerCase()) && matchesSuggestion(typed, suggestion))
      .sort((a, b) => {
        const q = normalizeSearch(typed);
        const aStarts = normalizeSearch(a).startsWith(q) ? 0 : 1;
        const bStarts = normalizeSearch(b).startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b, "sk");
      });
  }, [draft, query, suggestions]);

  const showDropdown = open && filtered.length > 0;

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const commit = useCallback(
    (next: string) => {
      setDraft(next);
      onChange(next);
    },
    [onChange]
  );

  const select = useCallback(
    (tag: string) => {
      commit(withSelectedTag(draft, tag));
      setOpen(false);
      inputRef.current?.focus();
    },
    [commit, draft]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (event.key === "Tab" || event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => (index + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => (index - 1 + filtered.length) % filtered.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(filtered[highlighted]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <input
        ref={inputRef}
        className={className ?? "input"}
        value={draft}
        onChange={(event) => {
          commit(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          focused.current = true;
          setOpen(true);
        }}
        onBlur={() => {
          focused.current = false;
          setOpen(false);
          const tags = parseTagsInput(draft) ?? [];
          rememberUsedQuestionTags(tags);
          const formatted = formatTagsInput(tags);
          if (formatted !== draft) setDraft(formatted);
          if (formatted !== value) onChange(formatted);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        lang="sk"
      />
      {showDropdown && (
        <ul className="absolute z-50 top-full mt-1 left-0 right-0 bg-brand-card border border-brand-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map((suggestion, index) => (
            <li
              key={suggestion}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                index === highlighted
                  ? "bg-brand-orange text-brand-btn-fg font-semibold"
                  : "text-brand-text hover:bg-brand-hover"
              }`}
              onMouseDown={(event) => {
                event.preventDefault();
                select(suggestion);
              }}
              onMouseEnter={() => setHighlighted(index)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
