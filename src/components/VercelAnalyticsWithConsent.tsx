"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { isAnalyticsAllowed } from "@/lib/cookie-consent";

export default function VercelAnalyticsWithConsent() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(isAnalyticsAllowed());
    sync();
    window.addEventListener("mudrc-consent-change", sync);
    return () => window.removeEventListener("mudrc-consent-change", sync);
  }, []);

  if (!allowed) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
