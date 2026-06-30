import { NextResponse } from "next/server";
import { readEvents } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readEvents();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}