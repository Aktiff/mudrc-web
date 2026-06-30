import { NextResponse } from "next/server";
import { readEvents } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { events } = await readEvents();
  const view = new URL(req.url).searchParams.get("view");

  const filtered =
    view === "liga"
      ? events.filter(
          (e) =>
            e.active !== false &&
            (e.leagueTable.length > 0 || e.pastResults.length > 0)
        )
      : events.filter((e) => e.active !== false);

  return NextResponse.json(
    { events: filtered },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
