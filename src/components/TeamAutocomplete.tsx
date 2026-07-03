"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
}

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
  return (
    normalizedSuggestion.startsWith(normalizedQuery) || normalizedSuggestion.includes(normalizedQuery)
  );
}

export function TeamAutocomplete({ value, onChange, suggestions, placeholder, className, onEnter }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const query = value.trim();
    if (!query) return [];

    return suggestions
      .filter((suggestion) => matchesSuggestion(query, suggestion))
      .sort((a, b) => {
        const q = normalizeSearch(query);
        const aStarts = normalizeSearch(a).startsWith(q) ? 0 : 1;
        const bStarts = normalizeSearch(b).startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b, "sk");
      });
  }, [suggestions, value]);

  const showDropdown = open && filtered.length > 0;

  useEffect(() => {
    setHighlighted(0);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      inputRef.current?.focus();
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === "Enter" && onEnter) {
        e.preventDefault();
        onEnter();
      }
      return;
    }
    if (e.key === "Tab" || e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <input
        ref={inputRef}
        className={className ?? "input"}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {showDropdown && (
        <ul className="absolute z-50 top-full mt-1 left-0 right-0 bg-brand-card border border-brand-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map((s, i) => (
            <li
              key={s}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                i === highlighted
                  ? "bg-brand-orange text-brand-btn-fg font-semibold"
                  : "text-brand-text hover:bg-brand-hover"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
