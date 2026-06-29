import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { QuizEvent } from "@/lib/data";

const dataPath = path.join(process.cwd(), "src/data/events.json");

function readData(): { events: QuizEvent[] } {
  let raw = fs.readFileSync(dataPath, "utf-8");
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

function writeData(data: { events: QuizEvent[] }) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf-8");
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  const body = await req.json();
  const data = readData();
  const idx = data.events.findIndex((e) => e.slug === params.slug);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data.events[idx] = { ...data.events[idx], ...body, slug: params.slug };
  writeData(data);
  return NextResponse.json(data.events[idx]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const data = readData();
  data.events = data.events.filter((e) => e.slug !== params.slug);
  writeData(data);
  return NextResponse.json({ ok: true });
}
