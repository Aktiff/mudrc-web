"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { getGtmId } from "@/lib/analytics-config";
import { isMarketingAllowed } from "@/lib/cookie-consent";

/** GTM (reklamy) až po súhlase s marketingom. Pred súhlasom sa skript nenačítava. */
export default function GoogleTagManager() {
  const [allowed, setAllowed] = useState(false);
  const gtmId = getGtmId();

  useEffect(() => {
    const sync = () => setAllowed(isMarketingAllowed());
    sync();
    window.addEventListener("mudrc-consent-change", sync);
    return () => window.removeEventListener("mudrc-consent-change", sync);
  }, []);

  if (!allowed || !gtmId) return null;

  return (
    <Script id="gtm-loader" strategy="lazyOnload">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
    </Script>
  );
}
