import { NextRequest, NextResponse } from "next/server";
import { readEvents, writeEvents } from "@/lib/storage";

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const data = await readEvents();
    const idx = data.events.findIndex((e) => e.slug === params.slug);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    data.events[idx] = { ...data.events[idx], ...body, slug: params.slug };
    await writeEvents(data);
    return NextResponse.json(data.events[idx]);
  } catch {
    return NextResponse.json({ error: "Chyba pri ukladani" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const data = await readEvents();
    data.events = data.events.filter((e) => e.slug !== params.slug);
    await writeEvents(data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Chyba pri mazani" }, { status: 500 });
  }
}