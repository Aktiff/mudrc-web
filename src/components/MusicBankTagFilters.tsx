"use client";

import { useMemo } from "react";
import type { MusicBankItem } from "@/lib/music-bank";
import {
  collectMusicFilterOptions,
  defaultMusicFilterOptionLists,
  type MusicBankTagFilters,
} from "@/lib/music-bank-filters";

type Props = {
  tracks: MusicBankItem[];
  value: MusicBankTagFilters;
  onChange: (next: MusicBankTagFilters) => void;
  className?: string;
};

export default function MusicBankTagFilters({ tracks, value, onChange, className = "" }: Props) {
  const fromBank = useMemo(() => collectMusicFilterOptions(tracks), [tracks]);
  const defaults = defaultMusicFilterOptionLists();

  const languages = useMemo(() => {
    const set = new Set<string>([...defaults.languages, ...fromBank.languages]);
    return Array.from(set);
  }, [defaults.languages, fromBank.languages]);

  const styles = useMemo(() => {
    const set = new Set<string>([...defaults.styles, ...fromBank.styles]);
    return Array.from(set);
  }, [defaults.styles, fromBank.styles]);

  const decades = fromBank.decades;

  if (tracks.length === 0) return null;

  const setField = (key: keyof MusicBankTagFilters, v: string) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 ${className}`}>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted block mb-1">
          Jazyk
        </label>
        <select
          className="input text-xs py-2 w-full"
          value={value.language}
          onChange={(e) => setField("language", e.target.value)}
        >
          <option value="">Všetko</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted block mb-1">
          Štýl
        </label>
        <select
          className="input text-xs py-2 w-full"
          value={value.style}
          onChange={(e) => setField("style", e.target.value)}
        >
          <option value="">Všetko</option>
          {styles.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted block mb-1">
          Dekáda
        </label>
        <select
          className="input text-xs py-2 w-full"
          value={value.decade}
          onChange={(e) => setField("decade", e.target.value)}
        >
          <option value="">Všetko</option>
          {decades.map((decade) => (
            <option key={decade} value={decade}>
              {decade}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
