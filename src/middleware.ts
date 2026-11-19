import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "mudrc2026";

/** Keep in sync with MODERATOR_USERS session tokens in admin-auth.ts (Edge-safe constants). */
const MODERATOR_SESSION_TOKENS = new Set(
  [
    process.env.MODERATOR_SIMONA_SESSION?.trim() ||
      "e8ac99841c372bfa142bffa448619dc63a8a21bf566796e3e9ab4f46ea22e318",
  ].filter(Boolean)
);

function isPayHostname(host: string): boolean {
  const h = host.split(":")[0].trim().toLowerCase();
  if (h === "pay.mudrc.sk") return true;
  if (h === "pay.localhost" || h === "pay.127.0.0.1") return true;
  if (process.env.PAY_FORCE_HOST === "1") return true;
  return false;
}

function resolveRole(session: string | undefined): "owner" | "moderator" | null {
  if (!session) return null;
  if (session === ADMIN_PASSWORD) return "owner";
  if (MODERATOR_SESSION_TOKENS.has(session)) return "moderator";
  return null;
}

function moderatorApiAllowed(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (pathname === "/api/admin/login") return true;
  if (pathname === "/api/admin/session" && m === "GET") return true;
  if (pathname === "/api/admin/events" && m === "GET") return true;
  if (pathname === "/api/admin/venue-teams" && m === "GET") return true;
  if (pathname === "/api/admin/quiz-library" && m === "GET") return true;
  if (/^\/api\/admin\/quiz-library\/[^/]+$/.test(pathname) && m === "GET") return true;
  if (/^\/api\/admin\/events\/[^/]+\/deck$/.test(pathname) && m === "GET") return true;
  if (/^\/api\/admin\/events\/[^/]+\/kviz$/.test(pathname) && m === "POST") return true;
  if (
    /^\/api\/admin\/events\/[^/]+\/kviz\/[^/]+$/.test(pathname) &&
    (m === "GET" || m === "PUT" || m === "PATCH")
  ) {
    return true;
  }
  return false;
}

function moderatorPageAllowed(pathname: string): boolean {
  if (pathname === "/admin" || pathname === "/admin/") return true;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return true;
  if (pathname === "/admin/udalosti" || pathname.startsWith("/admin/udalosti/")) return true;
  if (/^\/admin\/hotove-kvizy\/[^/]+\/prehrat\/?$/.test(pathname)) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";

  // pay.mudrc.sk → serve /pay/* at site root (URLs stay clean on the subdomain)
  if (isPayHostname(host)) {
    const passThrough =
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/pay") ||
      pathname === "/favicon.ico" ||
      pathname === "/icon" ||
      pathname === "/apple-icon" ||
      pathname.startsWith("/opengraph-image");

    if (!passThrough) {
      const url = req.nextUrl.clone();
      url.pathname = pathname === "/" ? "/pay" : `/pay${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  const isAdminPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isAdminApi =
    pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/login");

  if (isAdminPage || isAdminApi) {
    const session = req.cookies.get("admin_session")?.value;
    const role = resolveRole(session);
    if (!role) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    if (role === "moderator") {
      if (isAdminApi && !moderatorApiAllowed(pathname, req.method)) {
        return NextResponse.json(
          { error: "Nemáš oprávnenie na túto akciu." },
          { status: 403 }
        );
      }
      if (isAdminPage && !moderatorPageAllowed(pathname)) {
        return NextResponse.redirect(new URL("/admin/udalosti", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/((?!_next/static|_next/image|.*\\..*).*)",
  ],
};
