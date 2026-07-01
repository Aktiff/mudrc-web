import { NextResponse } from "next/server";
import { readEvents, getEventsStorageMeta } from "@/lib/storage";
import { getVisibleLeagues, isQuizVisible } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { events } = await readEvents();
  const storage = await getEventsStorageMeta();
  const view = new URL(req.url).searchParams.get("view");

  const filtered =
    view === "liga"
      ? getVisibleLeagues(events)
      : events.filter(isQuizVisible);

  return NextResponse.json(
    { events: filtered, _storage: storage },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
