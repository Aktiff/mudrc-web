import { NextRequest, NextResponse } from "next/server";
import { findModeratorByUsername, MODERATOR_USERS } from "@/lib/admin-auth";
import { getAdminSessionFromRequest, isOwnerRequest } from "@/lib/admin-session";
import {
  grantModeratorAccess,
  listGrantsForEvent,
  readModeratorGrants,
  revokeModeratorAccess,
} from "@/lib/moderator-grants";
import { readAllEventsRaw } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isOwnerRequest(req)) {
    return NextResponse.json({ error: "Nemáš oprávnenie na túto akciu." }, { status: 403 });
  }
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  const grants = slug ? await listGrantsForEvent(slug) : await readModeratorGrants();
  return NextResponse.json({
    moderators: MODERATOR_USERS.map((user) => user.username),
    grants,
  });
}

export async function POST(req: NextRequest) {
  if (!isOwnerRequest(req)) {
    return NextResponse.json({ error: "Nemáš oprávnenie na túto akciu." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    eventSlug?: string;
  };
  const username = String(body.username ?? "").trim();
  const eventSlug = String(body.eventSlug ?? "").trim();
  if (!findModeratorByUsername(username)) {
    return NextResponse.json({ error: "Neznámy moderátor." }, { status: 404 });
  }
  if (!eventSlug) {
    return NextResponse.json({ error: "Chýba udalosť." }, { status: 400 });
  }
  const { events } = await readAllEventsRaw();
  if (!events.some((event) => event.slug === eventSlug)) {
    return NextResponse.json({ error: "Udalosť neexistuje." }, { status: 404 });
  }
  try {
    const session = getAdminSessionFromRequest(req);
    const grant = await grantModeratorAccess({
      username,
      eventSlug,
      grantedBy: session?.username ?? "owner",
    });
    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri udeľovaní práv.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isOwnerRequest(req)) {
    return NextResponse.json({ error: "Nemáš oprávnenie na túto akciu." }, { status: 403 });
  }
  const fromQueryUser = req.nextUrl.searchParams.get("username")?.trim() ?? "";
  const fromQuerySlug = req.nextUrl.searchParams.get("eventSlug")?.trim() ?? "";
  let username = fromQueryUser;
  let eventSlug = fromQuerySlug;
  if (!username || !eventSlug) {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      eventSlug?: string;
    };
    username = username || String(body.username ?? "").trim();
    eventSlug = eventSlug || String(body.eventSlug ?? "").trim();
  }
  if (!username || !eventSlug) {
    return NextResponse.json({ error: "Chýba moderátor alebo udalosť." }, { status: 400 });
  }
  const removed = await revokeModeratorAccess(username, eventSlug);
  return NextResponse.json({ ok: true, removed });
}
