import { cookies } from "next/headers";
import { resolveAdminSession, type AdminSession } from "@/lib/admin-auth";
import { listGrantedEventSlugs } from "@/lib/moderator-grants";

export function getServerAdminSession(): AdminSession | null {
  const value = cookies().get("admin_session")?.value;
  return resolveAdminSession(value);
}

export async function getServerAdminContext(): Promise<{
  session: AdminSession | null;
  grantedEventSlugs: string[];
}> {
  const session = getServerAdminSession();
  if (!session) return { session: null, grantedEventSlugs: [] };
  if (session.role === "owner") return { session, grantedEventSlugs: [] };
  return {
    session,
    grantedEventSlugs: await listGrantedEventSlugs(session.username),
  };
}
