import { NextRequest, NextResponse } from "next/server";
import type { AdminSession } from "@/lib/admin-auth";
import { getAdminSessionFromRequest } from "@/lib/admin-session";
import {
  moderatorCanAccessEvent,
  moderatorCanEditSavedScores,
  moderatorCanSaveNewScores,
} from "@/lib/moderator-grants";

export function requireAdminSession(req: NextRequest): AdminSession | NextResponse {
  const session = getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 });
  }
  return session;
}

export function requireOwnerSession(req: NextRequest): AdminSession | NextResponse {
  const session = requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Nemáš oprávnenie na túto akciu." }, { status: 403 });
  }
  return session;
}

export async function requireEventAccess(
  req: NextRequest,
  eventSlug: string
): Promise<AdminSession | NextResponse> {
  const session = requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  if (session.role === "owner") return session;
  if (!(await moderatorCanAccessEvent(session.username, eventSlug))) {
    return NextResponse.json(
      { error: "Nemáš prístup k tejto udalosti." },
      { status: 403 }
    );
  }
  return session;
}

export async function requireScoreCreateAccess(
  req: NextRequest,
  eventSlug: string
): Promise<AdminSession | NextResponse> {
  const session = requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  if (session.role === "owner") return session;
  if (!(await moderatorCanSaveNewScores(session.username, eventSlug))) {
    return NextResponse.json(
      { error: "Nemáš právo ukladať výsledky na tejto udalosti." },
      { status: 403 }
    );
  }
  return session;
}

export async function requireScoreEditAccess(
  req: NextRequest,
  eventSlug: string,
  savedBy: string | undefined | null,
  savedAt: string | undefined | null
): Promise<AdminSession | NextResponse> {
  const session = requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  if (session.role === "owner") return session;
  if (!(await moderatorCanEditSavedScores(session.username, eventSlug, savedBy, savedAt))) {
    return NextResponse.json(
      {
        error:
          "Môžeš upravovať len výsledkové tabuľky, ktoré si sama uložila po pridelení práv.",
      },
      { status: 403 }
    );
  }
  return session;
}

export function scoreSaverFields(session: AdminSession): { savedBy: string; savedAt: string } {
  return {
    savedBy: session.username,
    savedAt: new Date().toISOString(),
  };
}
