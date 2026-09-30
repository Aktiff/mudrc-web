import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import { deleteVenueTeam, readVenueTeams } from "@/lib/venue-teams";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } as const;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Neautorizované" }, { status: 401 });
  }
  const teams = await readVenueTeams();
  return NextResponse.json({ teams }, { headers: NO_STORE });
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
