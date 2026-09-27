"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CookieNotice = dynamic(() => import("@/components/CookieNotice"), { ssr: false });

/** Cookie UI až po prvom idle — menej práce pri cold starte (hlavne mobile). */
export default function DeferredCookieNotice() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = () => setReady(true);
    const idle = window.requestIdleCallback?.(mount, { timeout: 3000 });
    if (idle !== undefined) {
      return () => window.cancelIdleCallback?.(idle);
    }
    const t = window.setTimeout(mount, 1500);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) return null;
  return <CookieNotice />;
}
