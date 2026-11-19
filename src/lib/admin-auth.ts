import { createHash, timingSafeEqual } from "crypto";

export type AdminRole = "owner" | "moderator";

export type AdminSession = {
  role: AdminRole;
  username: string;
};

export type ModeratorUser = {
  username: string;
  /** sha256 hex of `mudrc-admin:${password}` — never store plaintext. */
  passwordHash: string;
  /** Opaque cookie value after login — not the password. */
  sessionToken: string;
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "mudrc2026";

/** Seeded moderator accounts. Password hashes only — no plaintext in repo. */
export const MODERATOR_USERS: ModeratorUser[] = [
  {
    username: "Simona",
    // hash of the seeded moderator password (set via ops; not committed as plaintext)
    passwordHash:
      process.env.MODERATOR_SIMONA_PASSWORD_HASH?.trim() ||
      "dfdcfa03d9f98eb9bef5b9f9c76434d847d4d661133fc17d82bb80323cdb88ed",
    sessionToken:
      process.env.MODERATOR_SIMONA_SESSION?.trim() ||
      "e8ac99841c372bfa142bffa448619dc63a8a21bf566796e3e9ab4f46ea22e318",
  },
];

export function hashAdminPassword(password: string): string {
  return createHash("sha256").update(`mudrc-admin:${password}`, "utf8").digest("hex");
}

export function moderatorSessionToken(username: string, passwordHash: string): string {
  return createHash("sha256")
    .update(`mudrc-mod-session:${username}:${passwordHash}`, "utf8")
    .digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, "utf8");
    const b = Buffer.from(right, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getAdminPassword(): string {
  return ADMIN_PASSWORD;
}

export function findModeratorByUsername(username: string | undefined | null): ModeratorUser | undefined {
  const key = (username ?? "").trim().toLowerCase();
  if (!key) return undefined;
  return MODERATOR_USERS.find((user) => user.username.toLowerCase() === key);
}

export function resolveAdminSession(session: string | undefined | null): AdminSession | null {
  if (!session) return null;
  const value = session.trim();
  if (!value) return null;
  if (value === ADMIN_PASSWORD) {
    return { role: "owner", username: "owner" };
  }
  for (const user of MODERATOR_USERS) {
    if (value === user.sessionToken) {
      return { role: "moderator", username: user.username };
    }
  }
  return null;
}

export function isOwnerSession(session: AdminSession | null | undefined): boolean {
  return session?.role === "owner";
}

export function isModeratorSession(session: AdminSession | null | undefined): boolean {
  return session?.role === "moderator";
}

export function authenticateAdminLogin(input: {
  username?: string;
  password?: string;
}): { session: AdminSession; cookieValue: string } | null {
  const password = typeof input.password === "string" ? input.password : "";
  const username = typeof input.username === "string" ? input.username.trim() : "";

  if (!password) return null;

  const moderator = findModeratorByUsername(username);
  if (moderator) {
    const hash = hashAdminPassword(password);
    if (!safeEqualHex(hash, moderator.passwordHash)) return null;
    const expectedSession =
      moderator.sessionToken || moderatorSessionToken(moderator.username, moderator.passwordHash);
    return {
      session: { role: "moderator", username: moderator.username },
      cookieValue: expectedSession,
    };
  }

  // Owner: password-only (legacy) or username owner/admin
  const ownerUser =
    !username || username.toLowerCase() === "owner" || username.toLowerCase() === "admin";
  if (ownerUser && password === ADMIN_PASSWORD) {
    return {
      session: { role: "owner", username: "owner" },
      cookieValue: ADMIN_PASSWORD,
    };
  }

  return null;
}

export function parseAdminSessionFromCookieHeader(cookieHeader: string | null | undefined): AdminSession | null {
  const cookie = cookieHeader ?? "";
  const match = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return resolveAdminSession(decodeURIComponent(match[1]));
  } catch {
    return resolveAdminSession(match[1]);
  }
}

/** Middleware-safe: which admin API paths a moderator may call. */
export function moderatorApiAllowed(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (pathname === "/api/admin/login") return true;
  if (pathname === "/api/admin/session" && m === "GET") return true;
  if (pathname === "/api/admin/events" && m === "GET") return true;
  if (pathname === "/api/admin/venue-teams" && m === "GET") return true;
  if (pathname === "/api/admin/quiz-library" && m === "GET") return true;
  if (/^\/api\/admin\/quiz-library\/[^/]+$/.test(pathname) && m === "GET") return true;
  if (/^\/api\/admin\/events\/[^/]+\/deck$/.test(pathname) && m === "GET") return true;
  if (/^\/api\/admin\/events\/[^/]+\/kviz$/.test(pathname) && m === "POST") return true;
  if (/^\/api\/admin\/events\/[^/]+\/kviz\/[^/]+$/.test(pathname) && (m === "GET" || m === "PUT" || m === "PATCH")) {
    return true;
  }
  return false;
}

/** Middleware-safe: which admin pages a moderator may open. */
export function moderatorPageAllowed(pathname: string): boolean {
  if (pathname === "/admin" || pathname === "/admin/") return true;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return true;
  if (pathname === "/admin/udalosti" || pathname.startsWith("/admin/udalosti/")) return true;
  // Play presentations only — not the quiz editor list root for creating content
  if (/^\/admin\/hotove-kvizy\/[^/]+\/prehrat\/?$/.test(pathname)) return true;
  return false;
}

export function forbiddenJson(message = "Nemáš oprávnenie na túto akciu."): Response {
  return Response.json({ error: message }, { status: 403 });
}
