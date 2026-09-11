import { NextRequest, NextResponse } from "next/server";
import { readSeatPlanByToken } from "@/lib/seat-plan-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = params.token?.trim() ?? "";
    if (!token) {
      return NextResponse.json({ error: "Chýba odkaz." }, { status: 400, headers: noStore });
    }
    const plan = await readSeatPlanByToken(token);
    if (!plan) {
      return NextResponse.json({ error: "Zasadací poriadok sa nenašiel." }, { status: 404, headers: noStore });
    }
    return NextResponse.json(plan, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa načítať zasadací.";
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}
