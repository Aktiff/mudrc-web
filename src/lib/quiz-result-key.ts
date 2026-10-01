import type { PastResult } from "@/lib/data";

export function normalizeDateKey(date: string): string {
  return date.trim().replace(/\s+/g, "").replace(/\./g, "-");
}

export function quizResultKey(r: Pick<PastResult, "id" | "date">): string {
  if (r.id) return r.id;
  return normalizeDateKey(r.date);
}

export function decodeQuizParam(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

function matchesQuizParam(r: PastResult, key: string): boolean {
  if (r.id === key) return true;
  if (quizResultKey(r) === key) return true;
  if (normalizeDateKey(r.date) === key) return true;
  if (normalizeDateKey(r.date) === normalizeDateKey(key)) return true;
  if (r.date.trim() === key) return true;
  return false;
}

export function findQuizResult(results: PastResult[], param: string): PastResult | undefined {
  const key = decodeQuizParam(param);
  return results.find((r) => matchesQuizParam(r, key));
}

export function findQuizResultIndex(results: PastResult[], param: string): number {
  const key = decodeQuizParam(param);
  return results.findIndex((r) => matchesQuizParam(r, key));
}

/** Pri merge nikdy nestratime teams detail kvizu. */
export function mergePastResults(local: PastResult[], server: PastResult[]): PastResult[] {
  const map = new Map<string, PastResult>();

  const put = (r: PastResult) => {
    const key = quizResultKey(r);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
      return;
    }
    const pickTeams = (a?: PastResult, b?: PastResult) => {
      const aLen = a?.teams?.length ?? 0;
      const bLen = b?.teams?.length ?? 0;
      if (bLen > aLen) return b?.teams;
      if (aLen > bLen) return a?.teams;
      return b?.teams ?? a?.teams;
    };
    map.set(key, {
      ...existing,
      ...r,
      teams: pickTeams(existing, r),
      playerCount: r.playerCount ?? existing.playerCount,
      quizType: r.quizType?.trim() || existing.quizType,
    });
  };

  for (const r of server) put(r);
  for (const r of local) put(r);
  return Array.from(map.values());
}
