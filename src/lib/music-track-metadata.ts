import { normalizeTags } from "@/lib/quiz-question-tags";

const USER_AGENT = "MudrcQuiz/1.0 (https://mudrc.sk; kviz@mudrc.sk)";

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

const STYLE_RULES: { tag: string; keywords: string[] }[] = [
  { tag: "techno", keywords: ["techno", "trance", "house", "edm", "electronic", "electro", "dance", "drum and bass", "dnb", "dubstep"] },
  { tag: "rock", keywords: ["rock", "alternative", "indie", "punk", "grunge", "hard rock", "metal", "heavy metal", "progressive"] },
  { tag: "pop", keywords: ["pop", "synthpop", "dance-pop", "teen pop", "schlager"] },
  { tag: "klasika", keywords: ["classical", "baroque", "romantic", "opera", "symphony", "orchestral", "choral"] },
  { tag: "jazz", keywords: ["jazz", "swing", "bebop", "blues"] },
  { tag: "hip hop", keywords: ["hip hop", "hip-hop", "rap", "trap"] },
  { tag: "folk", keywords: ["folk", "country", "world", "celtic"] },
  { tag: "r&b", keywords: ["r&b", "soul", "funk", "motown"] },
  { tag: "disco", keywords: ["disco"] },
];

function inferStyleTag(names: string[]): string | null {
  const blob = names.join(" ").toLowerCase();
  for (const rule of STYLE_RULES) {
    if (rule.keywords.some((kw) => blob.includes(kw))) return rule.tag;
  }
  return null;
}

type MbRecordingSearch = {
  recordings?: {
    id: string;
    score?: number;
    title?: string;
    "first-release-date"?: string;
    tags?: { name: string; count?: number }[];
    genres?: { name: string; count?: number }[];
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

function parseYearFromIsoDate(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const y = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

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

function escapeLucene(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Tagy: jazyk, štýl (ak zistíme), dekáda vydania (ak zistíme). */
export async function lookupMusicTrackAutoTags(artist: string, title: string): Promise<string[]> {
  const a = artist.trim();
  const t = title.trim();
  if (!a || !t) return [];

  const query = encodeURIComponent(`recording:"${escapeLucene(t)}" AND artist:"${escapeLucene(a)}"`);
  const search = await musicBrainzJson<MbRecordingSearch>(`recording?query=${query}&limit=5&fmt=json`);
  const hit = search?.recordings?.sort((x, y) => (y.score ?? 0) - (x.score ?? 0))[0];

  let artistArea: string | undefined;
  let genreNames: string[] = [];
  let releaseYear: number | null = null;

  if (hit?.id) {
    const detail = await musicBrainzJson<MbRecordingDetail>(
      `recording/${hit.id}?inc=artist-credits+releases+tags+genres&fmt=json`
    );
    if (detail) {
      releaseYear = earliestReleaseYear(detail);
      genreNames = [
        ...(detail.tags?.map((x) => x.name) ?? []),
        ...(detail.genres?.map((x) => x.name) ?? []),
      ];
      const artistId = detail["artist-credit"]?.[0]?.artist?.id;
      const artistCountry = detail["artist-credit"]?.[0]?.artist?.country;
      if (artistCountry) artistArea = artistCountry;
      if (artistId) {
        const artistDetail = await musicBrainzJson<MbArtist>(`artist/${artistId}?inc=tags+genres&fmt=json`);
        if (artistDetail) {
          artistArea = artistDetail.area?.["iso-3166-1-alpha-2"] ?? artistDetail.country ?? artistArea;
          genreNames.push(
            ...(artistDetail.tags?.map((x) => x.name) ?? []),
            ...(artistDetail.genres?.map((x) => x.name) ?? [])
          );
        }
      }
    }
  } else if (hit) {
    releaseYear = parseYearFromIsoDate(hit["first-release-date"]);
    genreNames = [
      ...(hit.tags?.map((x) => x.name) ?? []),
      ...(hit.genres?.map((x) => x.name) ?? []),
    ];
  }

  const tags: string[] = [];
  tags.push(inferLanguageTag(a, t, artistArea));

  const style = inferStyleTag(genreNames);
  if (style) tags.push(style);

  const decade = releaseYear != null ? formatReleaseDecadeTag(releaseYear) : null;
  if (decade) tags.push(decade);

  return normalizeTags(tags) ?? [];
}
