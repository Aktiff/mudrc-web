import { NextResponse } from "next/server";
import { getEventsStorageMeta, readEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const data = await readEvents();
  const storage = await getEventsStorageMeta();
  const event = data.events.find((e) => e.slug === params.slug);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...event, _storage: storage }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
