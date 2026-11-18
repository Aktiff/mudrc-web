import { NextRequest, NextResponse } from "next/server";
import { payCheckInPin } from "@/lib/pay-config";
import { setSeatCheckIn } from "@/lib/pay-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "").trim();
  const teamId = String(body.teamId ?? "").trim();
  const seatId = String(body.seatId ?? "").trim();

  if (pin !== payCheckInPin()) {
    return NextResponse.json({ error: "Nesprávny PIN." }, { status: 401 });
  }
  if (!teamId || !seatId) {
    return NextResponse.json({ error: "Chýba tím alebo lístok." }, { status: 400 });
  }

  const team = await setSeatCheckIn(teamId, seatId);
  if (!team) {
    return NextResponse.json({ error: "Check-in sa nepodaril (iba paid lístky)." }, { status: 400 });
  }

  const seat = team.seats.find((s) => s.id === seatId);
  return NextResponse.json({
    ok: true,
    checkedInAt: seat?.checkedInAt ?? null,
    teamId: team.id,
    seatId,
  });
}
