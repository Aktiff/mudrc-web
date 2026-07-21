import Script from "next/script";
import { CONSENT_BOOTSTRAP_SCRIPT } from "@/lib/cookie-consent";

/** Google Consent Mode v2 — default denied, pred načítaním gtm.js (rovnaké ako od Google/Gemini). */
export default function GoogleConsentMode() {
  return (
    <Script id="google-consent-mode-default" strategy="beforeInteractive">
      {CONSENT_BOOTSTRAP_SCRIPT}
    </Script>
  );
}
