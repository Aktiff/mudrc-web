import { NextResponse } from "next/server";
import { getSeedLeagueData } from "@/lib/league-seed";
import { rebuildLeagueFromPastResults } from "@/lib/league-rebuild";
import { mergePastResults } from "@/lib/quiz-result-key";
import { revalidatePublicEventPaths } from "@/lib/revalidate-public";
import { patchEvent, readEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const seed = getSeedLeagueData(params.slug);
  if (!seed) {
    return NextResponse.json(
      { error: "Pre túto udalosť nie je k dispozícii záloha ligy v projekte." },
      { status: 404 }
    );
  }

  try {
    const { events } = await readEvents();
    const current = events.find((event) => event.slug === params.slug);
    const mergedPastResults = mergePastResults(seed.pastResults, current?.pastResults ?? []);
    const rebuilt = rebuildLeagueFromPastResults(mergedPastResults, params.slug);

    const updated = await patchEvent(
      params.slug,
      {
        leagueTable: rebuilt.leagueTable,
        pastResults: rebuilt.pastResults,
        leagueActive: true,
      },
      { includeLeagueData: true }
    );

    await revalidatePublicEventPaths(params.slug);

    return NextResponse.json({
      ok: true,
      event: updated,
      restoredTeams: rebuilt.leagueTable.length,
      restoredResults: rebuilt.pastResults.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Obnova ligy zlyhala.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
