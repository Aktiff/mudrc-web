import { NextRequest, NextResponse } from "next/server";
import { authenticateAdminLogin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const auth = authenticateAdminLogin({
    username: body.username,
    password: body.password,
  });
  if (!auth) {
    return NextResponse.json({ error: "Nespravne prihlasovacie udaje" }, { status: 401 });
  }
  const res = NextResponse.json({
    ok: true,
    role: auth.session.role,
    username: auth.session.username,
  });
  res.cookies.set("admin_session", auth.cookieValue, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("admin_session");
  return res;
}
