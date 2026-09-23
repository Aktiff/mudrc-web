import type { MusicBankItem } from "@/lib/music-bank";
import {
  MUSIC_DECADE_TAG_PATTERN,
  MUSIC_LANGUAGE_TAGS,
  MUSIC_STYLE_TAGS,
  parseMusicBankTagBuckets,
} from "@/lib/music-track-metadata";

export type MusicBankTagFilters = {
  language: string;
  style: string;
  decade: string;
};

export const EMPTY_MUSIC_BANK_TAG_FILTERS: MusicBankTagFilters = {
  language: "",
  style: "",
  decade: "",
};

export function collectMusicFilterOptions(tracks: MusicBankItem[]): {
  languages: string[];
  styles: string[];
  decades: string[];
} {
  const languages = new Set<string>();
  const styles = new Set<string>();
  const decades = new Set<string>();

  for (const track of tracks) {
    const b = parseMusicBankTagBuckets(track.tags ?? []);
    if (b.language) languages.add(b.language);
    if (b.style) styles.add(b.style);
    if (b.decade) decades.add(b.decade);
  }

  const sortDecades = (a: string, b: string) => {
    const ya = decadeSortKey(a);
    const yb = decadeSortKey(b);
    return yb - ya;
  };

  return {
    languages: Array.from(languages).sort((a, b) => a.localeCompare(b, "sk")),
    styles: Array.from(styles).sort((a, b) => a.localeCompare(b, "sk")),
    decades: Array.from(decades).sort(sortDecades),
  };
}

function decadeSortKey(tag: string): number {
  const m = tag.match(/^(\d{2,4})'/);
  if (!m) return 0;
  const n = Number.parseInt(m[1], 10);
  return n >= 100 ? n : n >= 30 ? 1900 + n : 2000 + n;
}

export function musicTrackMatchesTagFilters(
  track: MusicBankItem,
  filters: MusicBankTagFilters
): boolean {
  const b = parseMusicBankTagBuckets(track.tags ?? []);
  if (filters.language && b.language !== filters.language) return false;
  if (filters.style && b.style !== filters.style) return false;
  if (filters.decade && b.decade !== filters.decade) return false;
  return true;
}

export function filterMusicBankTracks(
  tracks: MusicBankItem[],
  filters: MusicBankTagFilters
): MusicBankItem[] {
  const active =
    Boolean(filters.language) || Boolean(filters.style) || Boolean(filters.decade);
  if (!active) return tracks;
  return tracks.filter((t) => musicTrackMatchesTagFilters(t, filters));
}

export function musicTagFiltersActive(filters: MusicBankTagFilters): boolean {
  return Boolean(filters.language || filters.style || filters.decade);
}

/** Pre UI — známe hodnoty aj keď v banke zatiaľ chýbajú. */
export function defaultMusicFilterOptionLists(): {
  languages: readonly string[];
  styles: readonly string[];
} {
  return { languages: MUSIC_LANGUAGE_TAGS, styles: MUSIC_STYLE_TAGS };
}

export function isKnownMusicDecadeTag(tag: string): boolean {
  return MUSIC_DECADE_TAG_PATTERN.test(tag);
}
