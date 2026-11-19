import { NextRequest, NextResponse } from "next/server";
import { MODERATOR_USERS } from "@/lib/admin-auth";
import { getAdminSessionFromRequest } from "@/lib/admin-session";
import { listGrantedEventSlugs, listGrantsForEvent, readModeratorGrants } from "@/lib/moderator-grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 });
  }

  if (session.role === "owner") {
    const slug = req.nextUrl.searchParams.get("slug")?.trim();
    const grants = slug ? await listGrantsForEvent(slug) : await readModeratorGrants();
    return NextResponse.json({
      role: session.role,
      username: session.username,
      moderators: MODERATOR_USERS.map((user) => user.username),
      grants,
    });
  }

  const grantedEventSlugs = await listGrantedEventSlugs(session.username);
  return NextResponse.json({
    role: session.role,
    username: session.username,
    grantedEventSlugs,
  });
}
