/** Normalizácia a fuzzy párovanie skladieb — toleruje preklepy a rôzny zápis. */

export function compactMatchKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function cleanMusicSearchFragment(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\s*\([^)]*\)\s*/g, " ");
  s = s.replace(/\s*\[[^\]]*\]\s*/g, " ");
  s = s.replace(/\s*(official\s+(video|audio|lyric\s*video)|remaster(ed)?(\s+\d{4})?|live|radio\s+edit|extended\s+version)\s*/gi, " ");
  s = s.replace(/\s*(feat\.|ft\.|featuring)\s+[^–\-—]+$/i, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function buildMusicSearchQueries(artist: string, title: string): string[] {
  const a = cleanMusicSearchFragment(artist);
  const t = cleanMusicSearchFragment(title);
  const out: string[] = [];
  const push = (q: string) => {
    const x = q.replace(/\s+/g, " ").trim();
    if (x.length >= 2 && !out.includes(x)) out.push(x);
  };

  if (a && t) {
    push(`${a} ${t}`);
    push(`${t} ${a}`);
    push(`${a} - ${t}`);
  }
  if (t.length >= 4) push(t);
  if (a.length >= 3) push(a);

  const titleWords = t.split(/\s+/).filter(Boolean);
  if (a && titleWords.length > 2) {
    push(`${a} ${titleWords.slice(0, 2).join(" ")}`);
  }

  return out.slice(0, 8);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

function similarityRatio(a: string, b: string): number {
  const ca = compactMatchKey(a);
  const cb = compactMatchKey(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  if (ca.includes(cb) || cb.includes(ca)) {
    const shorter = Math.min(ca.length, cb.length);
    const longer = Math.max(ca.length, cb.length);
    return 0.82 + (shorter / longer) * 0.18;
  }
  const dist = levenshtein(ca, cb);
  const maxLen = Math.max(ca.length, cb.length);
  return Math.max(0, 1 - dist / maxLen);
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
  const tb = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((w) => {
    if (tb.has(w)) inter++;
  });
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

/** 0–1: ako dobre sedí výsledok k zadanému interpretovi a skladbe. */
export function scoreMusicTrackMatch(
  queryArtist: string,
  queryTitle: string,
  resultArtist: string,
  resultTitle: string
): number {
  const titleScore = Math.max(
    similarityRatio(queryTitle, resultTitle),
    tokenJaccard(queryTitle, resultTitle)
  );
  const artistScore = Math.max(
    similarityRatio(queryArtist, resultArtist),
    tokenJaccard(queryArtist, resultArtist)
  );

  const qTitle = compactMatchKey(queryTitle);
  const rTitle = compactMatchKey(resultTitle);
  const titleOnlyOk = qTitle.length >= 4 && titleScore >= 0.72;

  if (!queryArtist.trim() || compactMatchKey(queryArtist).length < 2) {
    return titleScore;
  }

  if (titleOnlyOk && artistScore < 0.35) {
    return titleScore * 0.92;
  }

  return artistScore * 0.38 + titleScore * 0.62;
}

export const MUSIC_TRACK_MATCH_MIN = 0.48;
export const MUSIC_TRACK_MATCH_TITLE_STRONG = 0.78;

export type TrackMetadataCandidate = {
  artist: string;
  title: string;
  releaseYear: number | null;
  genreHints: string[];
  artistAreaCode?: string;
};

export type ScoredTrackHit = TrackMetadataCandidate & { score: number };

export function pickBestScoredTrack(
  queryArtist: string,
  queryTitle: string,
  candidates: TrackMetadataCandidate[]
): ScoredTrackHit | null {
  let best: ScoredTrackHit | null = null;
  for (const c of candidates) {
    const score = scoreMusicTrackMatch(queryArtist, queryTitle, c.artist, c.title);
    const titleOnly = scoreMusicTrackMatch("", queryTitle, "", c.title);
    const ok = score >= MUSIC_TRACK_MATCH_MIN || titleOnly >= MUSIC_TRACK_MATCH_TITLE_STRONG;
    if (!ok) continue;
    const finalScore = Math.max(score, titleOnly * 0.95);
    if (!best || finalScore > best.score) {
      best = { ...c, score: finalScore };
    }
  }
  return best;
}
