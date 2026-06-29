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

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET() {
  return NextResponse.json(readData());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = readData();
  const newEvent: QuizEvent = {
    ...body,
    slug: body.slug || slugify(body.venue),
    leagueTable: body.leagueTable ?? [],
    pastResults: body.pastResults ?? [],
  };
  if (data.events.find((e) => e.slug === newEvent.slug)) {
    return NextResponse.json({ error: "Udalost s tymto slug uz existuje" }, { status: 409 });
  }
  data.events.push(newEvent);
  writeData(data);
  return NextResponse.json(newEvent, { status: 201 });
}
