"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTagsInput, parseTagsInput } from "@/lib/quiz-question-tags";
import {
  fetchUsedQuestionTags,
  forgetUsedQuestionTag,
  peekUsedQuestionTags,
  rememberUsedQuestionTags,
  subscribeUsedQuestionTags,
} from "@/lib/used-question-tags-client";
import { notifyCustomBankUpdated } from "@/lib/quiz-custom-bank";

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

function tagsFromValue(value: string): string[] {
  return parseTagsInput(value) ?? [];
}

export default function TagSuggestInput({ value, onChange, className, placeholder }: Props) {
  const [selected, setSelected] = useState<string[]>(() => tagsFromValue(value));
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const focused = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused.current) {
      setSelected(tagsFromValue(value));
      setQuery("");
    }
  }, [value]);

  useEffect(() => {
    void fetchUsedQuestionTags().then((tags) => setSuggestions(tags));
    return subscribeUsedQuestionTags(() => setSuggestions(peekUsedQuestionTags()));
  }, []);

  const emit = useCallback(
    (tags: string[]) => {
      const next = tags.slice(0, 8);
      setSelected(next);
      onChange(formatTagsInput(next));
      rememberUsedQuestionTags(next);
    },
    [onChange]
  );

  const filtered = useMemo(() => {
    const typed = query.trim();
    if (!typed) return [];
    const used = new Set(selected.map((tag) => tag.toLowerCase()));
    return suggestions
      .filter((suggestion) => !used.has(suggestion.toLowerCase()) && matchesSuggestion(typed, suggestion))
      .sort((a, b) => {
        const q = normalizeSearch(typed);
        const aStarts = normalizeSearch(a).startsWith(q) ? 0 : 1;
        const bStarts = normalizeSearch(b).startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b, "sk");
      });
  }, [query, selected, suggestions]);

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

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim().toLowerCase();
      if (!tag) return;
      if (selected.some((item) => item.toLowerCase() === tag)) {
        setQuery("");
        return;
      }
      if (selected.length >= 8) return;
      emit([...selected, tag]);
      setQuery("");
      setOpen(false);
      inputRef.current?.focus();
    },
    [emit, selected]
  );

  const removeTag = useCallback(
    (tag: string) => {
      emit(selected.filter((item) => item !== tag));
      inputRef.current?.focus();
    },
    [emit, selected]
  );

  const deleteTagPermanently = useCallback(
    (tag: string) => {
      const confirmed = window.confirm(
        `Natrvalo zmazať tag „${tag}“ z návrhov a zo všetkých otázok v banke?`
      );
      if (!confirmed) return;
      void forgetUsedQuestionTag(tag)
        .then(() => {
          if (selected.some((item) => item.toLowerCase() === tag.toLowerCase())) {
            emit(selected.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
          }
          notifyCustomBankUpdated();
          inputRef.current?.focus();
        })
        .catch(() => {
          window.alert("Tag sa nepodarilo zmazať. Skús to znova.");
        });
    },
    [emit, selected]
  );

  const commitQueryAsTag = useCallback(() => {
    const typed = query.trim();
    if (!typed) return false;
    addTag(typed.replace(/[,;]+$/g, ""));
    return true;
  }, [addTag, query]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !query && selected.length) {
      event.preventDefault();
      removeTag(selected[selected.length - 1]!);
      return;
    }

    if (event.key === "," || event.key === ";") {
      event.preventDefault();
      commitQueryAsTag();
      return;
    }

    if (showDropdown) {
      if (event.key === "Tab" || event.key === "ArrowDown") {
        event.preventDefault();
        setHighlighted((index) => (index + 1) % filtered.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((index) => (index - 1 + filtered.length) % filtered.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        addTag(filtered[highlighted]!);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitQueryAsTag();
    }
  };

  const shellClass =
    className ??
    "input";

  return (
    <div className="relative" ref={ref}>
      <div
        className={`${shellClass} flex flex-wrap items-center gap-1.5 min-h-[2.5rem] cursor-text`}
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((tag) => (
          <span
            key={tag}
            className="group inline-flex items-center gap-1 max-w-full rounded-full border border-brand-border bg-brand-warm px-2 py-0.5 text-xs font-semibold text-brand-text"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeTag(tag);
              }}
              className="shrink-0 w-4 h-4 inline-flex items-center justify-center rounded-full text-brand-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40 transition-opacity"
              aria-label={`Odstrániť tag ${tag}`}
              title="Odstrániť"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="flex-1 min-w-[7rem] bg-transparent border-0 outline-none text-sm py-0.5 text-brand-text placeholder:text-brand-muted"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            focused.current = true;
            setOpen(true);
          }}
          onBlur={() => {
            focused.current = false;
            setOpen(false);
            if (query.trim()) commitQueryAsTag();
          }}
          onKeyDown={handleKeyDown}
          placeholder={selected.length ? "" : placeholder}
          autoComplete="off"
          spellCheck={false}
          lang="sk"
        />
      </div>
      {showDropdown && (
        <ul className="absolute z-50 top-full mt-1 left-0 right-0 bg-brand-card border border-brand-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map((suggestion, index) => {
            const active = index === highlighted;
            return (
              <li
                key={suggestion}
                className={`group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                  active
                    ? "bg-brand-orange text-brand-btn-fg font-semibold"
                    : "text-brand-text hover:bg-brand-hover"
                }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  addTag(suggestion);
                }}
                onMouseEnter={() => setHighlighted(index)}
              >
                <span className="flex-1 truncate">{suggestion}</span>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteTagPermanently(suggestion);
                  }}
                  className={`shrink-0 w-5 h-5 inline-flex items-center justify-center rounded-full text-sm leading-none opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ${
                    active
                      ? "hover:bg-black/15 text-brand-btn-fg"
                      : "text-brand-muted hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40"
                  }`}
                  aria-label={`Natrvalo zmazať tag ${suggestion}`}
                  title="Natrvalo zmazať z návrhov"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
