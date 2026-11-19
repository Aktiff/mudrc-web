import {
  parseAdminSessionFromCookieHeader,
  resolveAdminSession,
  type AdminSession,
} from "@/lib/admin-auth";

export type { AdminSession };

/** @deprecated Prefer resolveAdminSession / getAdminSessionFromRequest — owner-only check. */
export function isAdminCookieValue(session: string | undefined | null): boolean {
  const resolved = resolveAdminSession(session);
  return resolved?.role === "owner";
}

/** True for any valid admin session (owner or moderator). */
export function isAdminRequest(request: Request): boolean {
  return getAdminSessionFromRequest(request) != null;
}

export function isOwnerRequest(request: Request): boolean {
  return getAdminSessionFromRequest(request)?.role === "owner";
}

export function getAdminSessionFromRequest(request: Request): AdminSession | null {
  return parseAdminSessionFromCookieHeader(request.headers.get("cookie"));
}

export function getAdminSessionFromCookieValue(session: string | undefined | null): AdminSession | null {
  return resolveAdminSession(session);
}
