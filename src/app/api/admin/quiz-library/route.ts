import { NextRequest, NextResponse } from "next/server";
import { collectPlayedTeamNames, getConflictingTeams, isQuizSafeForTeams, parseTeamFilterInput } from "@/lib/quiz-library";
import { buildQuizUsageMap } from "@/lib/quiz-library-usage";
import { readAllLibraryQuizzes } from "@/lib/quiz-library-storage";
import { readAllEventsRaw, readAllStoredQuizzes } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const teamsParam = req.nextUrl.searchParams.get("teams") ?? "";
    const filterTeams = parseTeamFilterInput(teamsParam);

    const [quizzes, storedQuizzes, { events }] = await Promise.all([
      readAllLibraryQuizzes(),
      readAllStoredQuizzes(),
      readAllEventsRaw(),
    ]);
    const usageMap = buildQuizUsageMap(storedQuizzes, events);

    const items = quizzes
      .map((quiz) => {
        const usages = usageMap.get(quiz.id) ?? [];
        const playedTeamNames = collectPlayedTeamNames(usages);
        const conflictingTeams = getConflictingTeams(playedTeamNames, filterTeams);
        return {
          ...quiz,
          usageCount: usages.length,
          usages,
          playedTeamNames,
          conflictingTeams,
          isSafe: isQuizSafeForTeams(playedTeamNames, filterTeams),
        };
      })
      .sort((a, b) => {
        if (filterTeams.length && a.isSafe !== b.isSafe) return a.isSafe ? -1 : 1;
        if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

    return NextResponse.json(
      { quizzes: items, filterTeams },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa načítať kvízy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { title?: string };
    const { createLibraryQuiz } = await import("@/lib/quiz-library-storage");
    const quiz = await createLibraryQuiz(body.title);
    return NextResponse.json(quiz);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa vytvoriť kvíz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
