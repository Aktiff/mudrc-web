"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getGaMeasurementId } from "@/lib/analytics-config";
import { isAnalyticsAllowed } from "@/lib/cookie-consent";

function isTrackedPath(path: string): boolean {
  return !path.startsWith("/admin") && !path.startsWith("/zasadacie");
}

function isPublicSite(): boolean {
  const host = window.location.hostname;
  return host === "mudrc.sk" || host === "www.mudrc.sk" || host === "liga.mudrc.sk";
}

/** GA4 až po súhlase so štatistikami. Pred súhlasom sa skript nenačítava. */
export default function GoogleAnalytics() {
  const pathname = usePathname();
  const started = useRef(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const id = getGaMeasurementId();
    if (!id) return;

    const send = () => {
      if (!isAnalyticsAllowed() || !isPublicSite()) return;
      const path = `${window.location.pathname}${window.location.search}`;
      if (!isTrackedPath(path) || lastPath.current === path) return;
      lastPath.current = path;
      window.gtag?.("event", "page_view", {
        send_to: id,
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
      });
    };

    const enable = () => {
      if (!isAnalyticsAllowed() || !isPublicSite()) return;
      const path = window.location.pathname;
      if (!isTrackedPath(path)) return;
      if (!started.current) {
        started.current = true;
        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
        document.head.appendChild(script);
        window.gtag?.("js", new Date());
        window.gtag?.("config", id, { send_page_view: false });
      }
      send();
    };

    enable();
    window.addEventListener("mudrc-consent-change", enable);
    return () => window.removeEventListener("mudrc-consent-change", enable);
  }, [pathname]);

  return null;
}
