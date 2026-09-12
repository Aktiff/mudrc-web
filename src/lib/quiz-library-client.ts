/** URL na zoznam hotových kvízov (vždy platný query string). */
export function quizLibraryListRequestUrl(teamNames: string[] = []): string {
  const params = new URLSearchParams();
  const teams = teamNames.map((name) => name.trim()).filter(Boolean);
  if (teams.length) params.set("teams", teams.join("\n"));
  params.set("_", String(Date.now()));
  return `/api/admin/quiz-library?${params.toString()}`;
}

export type LibraryQuizListItem = {
  id: string;
  title: string;
  usageCount: number;
  isSafe: boolean;
  conflictingTeams: string[];
};

export async function fetchLibraryQuizList(teamNames: string[] = []): Promise<LibraryQuizListItem[]> {
  const res = await fetch(quizLibraryListRequestUrl(teamNames), { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.quizzes ?? []) as LibraryQuizListItem[];
}
