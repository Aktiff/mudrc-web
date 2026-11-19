"use client";

import { useEffect, useState } from "react";

export type ClientAdminSession = {
  role: "owner" | "moderator";
  username: string;
  grantedEventSlugs?: string[];
  moderators?: string[];
};

export function useAdminSession() {
  const [session, setSession] = useState<ClientAdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/session?_=${Date.now()}`, { cache: "no-store", credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as ClientAdminSession;
      })
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading, isOwner: session?.role === "owner", isModerator: session?.role === "moderator" };
}
