"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hasCookieConsent, setCookieConsent } from "@/lib/cookie-consent";

export default function CookieNotice() {
  const pathname = usePathname();
  const onAdmin = pathname?.startsWith("/admin") ?? false;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (onAdmin) return;
    if (!hasCookieConsent()) setVisible(true);
  }, [onAdmin]);

  if (!visible || onAdmin) return null;

  const accept = () => {
    setCookieConsent("accepted");
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[110] p-4 sm:p-5 pointer-events-none"
      role="dialog"
      aria-labelledby="cookie-notice-title"
      aria-describedby="cookie-notice-desc"
    >
      <div className="pointer-events-auto max-w-4xl mx-auto bg-brand-card border border-brand-border rounded-2xl shadow-xl px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p id="cookie-notice-title" className="font-semibold text-brand-text text-sm sm:text-base">
            Cookies a ukladanie v prehliadači
          </p>
          <p id="cookie-notice-desc" className="text-brand-muted text-xs sm:text-sm mt-1 leading-relaxed">
            Používame nevyhnutné údaje na fungovanie webu (napr. zapamätanie témy). Viac v{" "}
            <Link href="/cookies" className="text-brand-orange-readable font-medium hover:underline">
              informáciách o cookies
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/cookies"
            className="btn-outline text-sm py-2.5 px-4"
          >
            Viac informácií
          </Link>
          <button type="button" onClick={accept} className="btn-primary text-sm py-2.5 px-5">
            Súhlasím
          </button>
        </div>
      </div>
    </div>
  );
}
