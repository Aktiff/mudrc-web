const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "mudrc2026";

export function isAdminCookieValue(session: string | undefined | null): boolean {
  return session === ADMIN_PASSWORD;
}

export function isAdminRequest(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  return isAdminCookieValue(match?.[1] ? decodeURIComponent(match[1]) : undefined);
}
