import { NextRequest, NextResponse } from "next/server";
import type { SeatPlan } from "@/lib/seat-plan";
import { deleteSeatPlan, readSeatPlan, saveSeatPlan } from "@/lib/seat-plan-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const plan = await readSeatPlan(params.id);
    if (!plan) {
      return NextResponse.json({ error: "Zasadací poriadok sa nenašiel." }, { status: 404 });
    }
    return NextResponse.json(plan, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa načítať zasadací.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as SeatPlan;
    if (!body || body.id !== params.id) {
      return NextResponse.json({ error: "Neplatné údaje." }, { status: 400 });
    }
    const saved = await saveSeatPlan(body);
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa uložiť zasadací.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ok = await deleteSeatPlan(params.id);
    if (!ok) {
      return NextResponse.json({ error: "Zasadací poriadok sa nenašiel." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa zmazať zasadací.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
