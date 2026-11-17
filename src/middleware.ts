import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "mudrc2026";

function isPayHostname(host: string): boolean {
  const h = host.split(":")[0].trim().toLowerCase();
  if (h === "pay.mudrc.sk") return true;
  if (h === "pay.localhost" || h === "pay.127.0.0.1") return true;
  if (process.env.PAY_FORCE_HOST === "1") return true;
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
    if (session !== ADMIN_PASSWORD) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", req.url));
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
