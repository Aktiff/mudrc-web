import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import { deleteVenueTeam, linkVenueTeams, readVenueTeams, unlinkVenueTeam } from "@/lib/venue-teams";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } as const;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Neautorizované" }, { status: 401 });
  }
  const teams = await readVenueTeams();
  return NextResponse.json({ teams }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Neautorizované" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { action?: string; teamId?: string; otherTeamId?: string } | null;
  const action = body?.action;
  const teamId = body?.teamId?.trim() ?? "";
  try {
    if (action === "link") {
      const teams = await linkVenueTeams(teamId, body?.otherTeamId?.trim() ?? "");
      return NextResponse.json({ ok: true, teams }, { headers: NO_STORE });
    }
    if (action === "unlink") {
      const teams = await unlinkVenueTeam(teamId);
      return NextResponse.json({ ok: true, teams }, { headers: NO_STORE });
    }
    return NextResponse.json({ error: "Neznáma akcia." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prepojenie sa nepodarilo uložiť.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Neautorizované" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Chýba id" }, { status: 400 });
  const ok = await deleteVenueTeam(id);
  if (!ok) return NextResponse.json({ error: "Tím neexistuje" }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
