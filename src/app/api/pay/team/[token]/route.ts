import { NextResponse } from "next/server";
import { applyHoldExpiry, teamSummary } from "@/lib/pay-domain";
import { getTeamByToken } from "@/lib/pay-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight poll endpoint so the client can wait until Blob is readable. */
export async function GET(
  _req: Request,
  context: { params: { token: string } }
) {
  const token = String(context.params.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Chýba token." }, { status: 400 });
  }

  const raw = await getTeamByToken(token, { retries: 2, delayMs: 150 });
  if (!raw) {
    return NextResponse.json({ ok: false, ready: false }, { status: 404 });
  }

  const team = applyHoldExpiry(raw);
  const summary = teamSummary(team);
  return NextResponse.json({
    ok: true,
    ready: true,
    teamToken: team.token,
    teamName: team.teamName,
    status: team.status,
    summary,
  });
}
