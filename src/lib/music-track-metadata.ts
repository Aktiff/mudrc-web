import { normalizeTags } from "@/lib/quiz-question-tags";
import {
  buildMusicSearchQueries,
  pickBestScoredTrack,
  type TrackMetadataCandidate,
} from "@/lib/music-track-search";

const USER_AGENT = "MudrcQuiz/1.0 (https://mudrc.sk; kviz@mudrc.sk)";

export const MUSIC_LANGUAGE_TAGS = ["česká/slovenská", "anglická", "iná zahraničná"] as const;
export const MUSIC_DECADE_TAG_PATTERN = /^\d{2,4}'$/;

const STYLE_RULES: { tag: string; keywords: string[] }[] = [
  { tag: "techno", keywords: ["techno", "trance", "house", "edm", "electronic", "electro", "dance", "drum and bass", "dnb", "dubstep", "electronica"] },
  { tag: "rock", keywords: ["rock", "alternative", "indie", "punk", "grunge", "hard rock", "metal", "heavy metal", "progressive", "classic rock"] },
  { tag: "pop", keywords: ["pop", "synthpop", "dance-pop", "teen pop", "schlager", "adult contemporary"] },
  { tag: "klasika", keywords: ["classical", "baroque", "romantic", "opera", "symphony", "orchestral", "choral"] },
  { tag: "jazz", keywords: ["jazz", "swing", "bebop", "blues"] },
  { tag: "hip hop", keywords: ["hip hop", "hip-hop", "rap", "trap"] },
  { tag: "folk", keywords: ["folk", "country", "world", "celtic", "singer/songwriter"] },
  { tag: "r&b", keywords: ["r&b", "soul", "funk", "motown"] },
  { tag: "disco", keywords: ["disco"] },
];

export const MUSIC_STYLE_TAGS = STYLE_RULES.map((r) => r.tag);

export type MusicTagBuckets = {
  language?: string;
  style?: string;
  decade?: string;
};

let lastRequestAt = 0;

async function musicBrainzJson<T>(path: string): Promise<T | null> {
  const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  try {
    const res = await fetch(`https://musicbrainz.org/ws/2/${path}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function formatReleaseDecadeTag(year: number): string | null {
  if (!Number.isFinite(year) || year < 1920 || year > new Date().getFullYear() + 1) return null;
  if (year >= 2000) {
    const decade = Math.floor(year / 10) * 10;
    return `${decade}'`;
  }
  const short = year % 100;
  const decadeStart = Math.floor(short / 10) * 10;
  return `${decadeStart.toString().padStart(2, "0")}'`;
}

const CS_SK_AREA_CODES = new Set(["CZ", "SK"]);
const EN_AREA_CODES = new Set(["GB", "US", "IE", "AU", "NZ", "CA"]);

function hasCsSkDiacritics(text: string): boolean {
  return /[áäčďéěíľĺňóôřšťúůýžÁÄČĎÉĚÍĽĹŇÓÔŘŠŤÚŮÝŽ]/.test(text);
}

function inferLanguageTag(artist: string, title: string, artistAreaCode?: string): string {
  const code = artistAreaCode?.toUpperCase();
  if (code && CS_SK_AREA_CODES.has(code)) return "česká/slovenská";
  if (hasCsSkDiacritics(`${artist} ${title}`)) return "česká/slovenská";
  if (code && EN_AREA_CODES.has(code)) return "anglická";
  if (/^[a-z0-9\s.'&\-–—,!?:()+]+$/i.test(`${artist} ${title}`) && !hasCsSkDiacritics(`${artist} ${title}`)) {
    return "anglická";
  }
  return "iná zahraničná";
}

function inferStyleTag(names: string[]): string | null {
  const blob = names.join(" ").toLowerCase();
  for (const rule of STYLE_RULES) {
    if (rule.keywords.some((kw) => blob.includes(kw))) return rule.tag;
  }
  return null;
}

export function parseMusicBankTagBuckets(tags: string[]): MusicTagBuckets {
  const out: MusicTagBuckets = {};
  for (const tag of tags) {
    if (!out.language && (MUSIC_LANGUAGE_TAGS as readonly string[]).includes(tag)) {
      out.language = tag;
    } else if (!out.style && MUSIC_STYLE_TAGS.includes(tag)) {
      out.style = tag;
    } else if (!out.decade && MUSIC_DECADE_TAG_PATTERN.test(tag)) {
      out.decade = tag;
    }
  }
  return out;
}

function bucketsToTags(b: MusicTagBuckets): string[] {
  const tags: string[] = [];
  if (b.language) tags.push(b.language);
  if (b.style) tags.push(b.style);
  if (b.decade) tags.push(b.decade);
  return tags;
}

function parseYearFromIsoDate(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const y = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function escapeLucene(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

type MbRecordingSearch = {
  recordings?: {
    id: string;
    score?: number;
    title?: string;
    "first-release-date"?: string;
    tags?: { name: string }[];
    genres?: { name: string }[];
    "artist-credit"?: { name?: string; artist?: { name?: string; country?: string } }[];
  }[];
};

type MbRecordingDetail = {
  "first-release-date"?: string;
  tags?: { name: string }[];
  genres?: { name: string }[];
  releases?: { date?: string }[];
  "artist-credit"?: { artist?: { id?: string; name?: string; country?: string } }[];
};

type MbArtist = {
  country?: string;
  area?: { "iso-3166-1-alpha-2"?: string };
  tags?: { name: string }[];
  genres?: { name: string }[];
};

function earliestReleaseYear(recording: MbRecordingDetail): number | null {
  const direct = parseYearFromIsoDate(recording["first-release-date"]);
  if (direct) return direct;
  let min: number | null = null;
  for (const rel of recording.releases ?? []) {
    const y = parseYearFromIsoDate(rel.date);
    if (y != null && (min == null || y < min)) min = y;
  }
  return min;
}

function mbArtistName(hit: NonNullable<MbRecordingSearch["recordings"]>[number]): string {
  const credits = hit["artist-credit"] ?? [];
  const parts = credits.map((c) => c.artist?.name ?? c.name ?? "").filter(Boolean);
  return parts.join(" ").trim();
}

async function collectMusicBrainzCandidates(artist: string, title: string): Promise<TrackMetadataCandidate[]> {
  const queries = buildMusicSearchQueries(artist, title);
  const luceneQueries = [
    ...queries.slice(0, 4),
    ...queries.slice(0, 2).map((q) => {
      const parts = q.split(/\s+/);
      if (parts.length < 2) return q;
      return `recording:${escapeLucene(parts.slice(1).join(" "))} AND artist:${escapeLucene(parts[0])}`;
    }),
  ];

  const seen = new Set<string>();
  const light: TrackMetadataCandidate[] = [];
  const idByKey = new Map<string, string>();

  for (const q of luceneQueries.slice(0, 4)) {
    const search = await musicBrainzJson<MbRecordingSearch>(
      `recording?query=${encodeURIComponent(q)}&limit=15&fmt=json`
    );
    for (const hit of search?.recordings ?? []) {
      const rTitle = hit.title?.trim() ?? "";
      const rArtist = mbArtistName(hit);
      if (!rTitle) continue;
      const key = `${rArtist}|${rTitle}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (hit.id) idByKey.set(key, hit.id);

      light.push({
        artist: rArtist || artist,
        title: rTitle,
        releaseYear: parseYearFromIsoDate(hit["first-release-date"]),
        genreHints: [
          ...(hit.tags?.map((x) => x.name) ?? []),
          ...(hit.genres?.map((x) => x.name) ?? []),
        ],
        artistAreaCode: hit["artist-credit"]?.[0]?.artist?.country,
      });
    }
  }

  const best = pickBestScoredTrack(artist, title, light);
  if (!best) return light;

  const key = `${best.artist}|${best.title}`.toLowerCase();
  const recordingId = idByKey.get(key);
  if (!recordingId) return light;

  const detail = await musicBrainzJson<MbRecordingDetail>(
    `recording/${recordingId}?inc=artist-credits+releases+tags+genres&fmt=json`
  );
  if (!detail) return light;

  const enriched: TrackMetadataCandidate = {
    artist: best.artist,
    title: best.title,
    releaseYear: earliestReleaseYear(detail) ?? best.releaseYear,
    genreHints: [
      ...best.genreHints,
      ...(detail.tags?.map((x) => x.name) ?? []),
      ...(detail.genres?.map((x) => x.name) ?? []),
    ],
    artistAreaCode: detail["artist-credit"]?.[0]?.artist?.country ?? best.artistAreaCode,
  };

  const artistId = detail["artist-credit"]?.[0]?.artist?.id;
  if (artistId) {
    const artistDetail = await musicBrainzJson<MbArtist>(`artist/${artistId}?inc=tags+genres&fmt=json`);
    if (artistDetail) {
      enriched.artistAreaCode =
        artistDetail.area?.["iso-3166-1-alpha-2"] ?? artistDetail.country ?? enriched.artistAreaCode;
      enriched.genreHints.push(
        ...(artistDetail.tags?.map((x) => x.name) ?? []),
        ...(artistDetail.genres?.map((x) => x.name) ?? [])
      );
    }
  }

  return light.map((c) =>
    `${c.artist}|${c.title}`.toLowerCase() === key ? enriched : c
  );
}

type ItunesResult = {
  artistName?: string;
  trackName?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  collectionName?: string;
};

async function collectItunesCandidates(artist: string, title: string): Promise<TrackMetadataCandidate[]> {
  const queries = buildMusicSearchQueries(artist, title);
  const seen = new Set<string>();
  const candidates: TrackMetadataCandidate[] = [];

  for (const q of queries.slice(0, 5)) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=20`,
        { cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: ItunesResult[] };
      for (const r of data.results ?? []) {
        const rArtist = r.artistName?.trim() ?? "";
        const rTitle = r.trackName?.trim() ?? "";
        if (!rTitle) continue;
        const key = `${rArtist}|${rTitle}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const genreHints = [r.primaryGenreName, r.collectionName].filter(Boolean) as string[];
        candidates.push({
          artist: rArtist,
          title: rTitle,
          releaseYear: parseYearFromIsoDate(r.releaseDate),
          genreHints,
        });
      }
    } catch {
      /* ignore */
    }
  }

  return candidates;
}

type DeezerTrack = {
  title?: string;
  release_date?: string;
  artist?: { name?: string };
  album?: { title?: string; genre_id?: number };
};

async function collectDeezerCandidates(artist: string, title: string): Promise<TrackMetadataCandidate[]> {
  const queries = buildMusicSearchQueries(artist, title);
  const seen = new Set<string>();
  const candidates: TrackMetadataCandidate[] = [];

  for (const q of queries.slice(0, 5)) {
    try {
      const res = await fetch(
        `https://api.deezer.com/search/track?q=${encodeURIComponent(q)}&limit=20`,
        { cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { data?: DeezerTrack[] };
      for (const r of data.data ?? []) {
        const rArtist = r.artist?.name?.trim() ?? "";
        const rTitle = r.title?.trim() ?? "";
        if (!rTitle) continue;
        const key = `${rArtist}|${rTitle}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const genreHints = [r.album?.title].filter(Boolean) as string[];
        candidates.push({
          artist: rArtist,
          title: rTitle,
          releaseYear: parseYearFromIsoDate(r.release_date),
          genreHints,
        });
      }
    } catch {
      /* ignore */
    }
  }

  return candidates;
}

function candidateToBuckets(
  hit: TrackMetadataCandidate,
  queryArtist: string,
  queryTitle: string
): MusicTagBuckets {
  const style = inferStyleTag(hit.genreHints);
  const decade = hit.releaseYear != null ? formatReleaseDecadeTag(hit.releaseYear) : null;
  const language = inferLanguageTag(
    hit.artist || queryArtist,
    hit.title || queryTitle,
    hit.artistAreaCode
  );
  return {
    language,
    style: style ?? undefined,
    decade: decade ?? undefined,
  };
}

function mergeBucketFields(...parts: MusicTagBuckets[]): MusicTagBuckets {
  const out: MusicTagBuckets = {};
  for (const p of parts) {
    if (!out.language && p.language) out.language = p.language;
    if (!out.style && p.style) out.style = p.style;
    if (!out.decade && p.decade) out.decade = p.decade;
  }
  return out;
}

async function lookupOnlineTagBuckets(artist: string, title: string): Promise<MusicTagBuckets> {
  const [itunesList, deezerList, mbList] = await Promise.all([
    collectItunesCandidates(artist, title),
    collectDeezerCandidates(artist, title),
    collectMusicBrainzCandidates(artist, title),
  ]);

  const all = [...itunesList, ...deezerList, ...mbList];
  const best = pickBestScoredTrack(artist, title, all);
  if (!best) {
    return heuristicBuckets(artist, title);
  }

  const fromBest = candidateToBuckets(best, artist, title);

  const secondary: MusicTagBuckets[] = [];
  for (const source of [itunesList, deezerList, mbList]) {
    const hit = pickBestScoredTrack(artist, title, source);
    if (hit) secondary.push(candidateToBuckets(hit, artist, title));
  }

  return mergeBucketFields(fromBest, ...secondary, heuristicBuckets(best.artist, best.title));
}

function heuristicBuckets(artist: string, title: string): MusicTagBuckets {
  const style = inferStyleTag([artist, title]);
  return {
    language: inferLanguageTag(artist, title),
    style: style ?? undefined,
  };
}

/** Doplní chýbajúce tagy — fuzzy match cez iTunes, Deezer, MusicBrainz. */
export async function enrichMusicTrackAutoTags(
  artist: string,
  title: string,
  existing?: string[]
): Promise<string[]> {
  const a = artist.trim();
  const t = title.trim();
  if (!a || !t) return normalizeTags(existing) ?? [];

  const keep = parseMusicBankTagBuckets(existing ?? []);
  const online = await lookupOnlineTagBuckets(a, t);
  const heuristic = heuristicBuckets(a, t);

  const merged: MusicTagBuckets = {
    language: keep.language ?? online.language ?? heuristic.language,
    style: keep.style ?? online.style ?? heuristic.style,
    decade: keep.decade ?? online.decade,
  };

  return normalizeTags(bucketsToTags(merged)) ?? [];
}

/** Tagy pri novom uploade — rovnaké doplnenie ako pri obnove. */
export async function lookupMusicTrackAutoTags(artist: string, title: string): Promise<string[]> {
  return enrichMusicTrackAutoTags(artist, title, []);
}
