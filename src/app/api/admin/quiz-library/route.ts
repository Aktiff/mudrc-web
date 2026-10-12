import { NextRequest, NextResponse } from "next/server";
import { collectPlayedTeamNames, parseTeamFilterInput } from "@/lib/quiz-library";
import { buildQuizUsageMap, type QuizUsageExclude } from "@/lib/quiz-library-usage";
import { createLibraryQuiz, readAllLibraryQuizzes, readLibraryQuizSummaries } from "@/lib/quiz-library-storage";
import { describeQuizConflicts } from "@/lib/team-links";
import { readAllEventsRaw, readAllStoredQuizzes } from "@/lib/storage";
import { readVenueTeams } from "@/lib/venue-teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const teamsParam = req.nextUrl.searchParams.get("teams") ?? "";
    const filterTeams = parseTeamFilterInput(teamsParam);

    let excludeUsage: QuizUsageExclude | null = null;
    const excludeRaw = req.nextUrl.searchParams.get("excludeUsage")?.trim();
    if (excludeRaw) {
      const sep = excludeRaw.indexOf("|");
      if (sep > 0) {
        excludeUsage = {
          eventSlug: excludeRaw.slice(0, sep),
          quizResultId: excludeRaw.slice(sep + 1),
        };
      }
    }

    const wantsUsage = req.nextUrl.searchParams.get("usage") === "1";
    const needsUsage = wantsUsage || filterTeams.length > 0;
    const [storedQuizzes, eventsData, venueTeams] = needsUsage
      ? await Promise.all([
          readAllStoredQuizzes(),
          readAllEventsRaw(),
          filterTeams.length ? readVenueTeams() : Promise.resolve([]),
        ])
      : [[], { events: [] }, []];
    const usageMap = needsUsage
      ? buildQuizUsageMap(storedQuizzes, eventsData.events, excludeUsage)
      : new Map();

    if (req.nextUrl.searchParams.get("usage") !== "1") {
      const summaries = await readLibraryQuizSummaries();
      const items = summaries
        .map((quiz) => {
          const usages = usageMap.get(quiz.id) ?? [];
          const playedTeamNames = collectPlayedTeamNames(usages);
          const conflictingTeams = describeQuizConflicts(playedTeamNames, filterTeams, venueTeams);
          return {
            id: quiz.id,
            title: quiz.title,
            notes: quiz.notes,
            createdAt: quiz.createdAt,
            updatedAt: quiz.updatedAt,
            questions: Array.from({ length: quiz.questionCount }, () => ({ id: "" })),
            usageCount: usages.length,
            usages: [],
            playedTeamNames,
            conflictingTeams,
            isSafe: conflictingTeams.length === 0,
          };
        })
        .sort((a, b) => {
          if (filterTeams.length && a.isSafe !== b.isSafe) return a.isSafe ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      return NextResponse.json(
        { quizzes: items, filterTeams },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    }

    const quizzes = await readAllLibraryQuizzes();

    const items = quizzes
      .map((quiz) => {
        const usages = usageMap.get(quiz.id) ?? [];
        const playedTeamNames = collectPlayedTeamNames(usages);
        const conflictingTeams = describeQuizConflicts(playedTeamNames, filterTeams, venueTeams);
        return {
          ...quiz,
          usageCount: usages.length,
          usages,
          playedTeamNames,
          conflictingTeams,
          isSafe: filterTeams.length === 0 || conflictingTeams.length === 0,
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
    const quiz = await createLibraryQuiz(body.title);
    return NextResponse.json(quiz);
  } catch (error) {
    console.error("createLibraryQuiz error:", error);
    const message = error instanceof Error ? error.message : "Nepodarilo sa vytvoriť kvíz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
