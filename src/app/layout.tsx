import type { Metadata } from "next";
import { Poppins, Bebas_Neue } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ThemeSync from "@/components/ThemeSync";
import CookieNotice from "@/components/CookieNotice";
import GoogleTagManager from "@/components/GoogleTagManager";
import VercelAnalyticsWithConsent from "@/components/VercelAnalyticsWithConsent";
import { CONSENT_BOOTSTRAP_SCRIPT } from "@/lib/cookie-consent";
import { defaultSiteMetadata } from "@/lib/site-metadata";

const poppins = Poppins({ subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-poppins", display: "swap" });
const bebasNeue = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas", display: "swap" });

export const metadata: Metadata = defaultSiteMetadata;

// Runs before hydration to prevent flash of wrong theme
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=t==='dark'||((t==='system'||t===null)&&prefersDark);document.documentElement.classList.toggle('dark',dark)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" className={`${poppins.variable} ${bebasNeue.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: CONSENT_BOOTSTRAP_SCRIPT }} />
        <GoogleTagManager />
        <ThemeSync />
        <Navbar />
        <main>{children}</main>
        <Footer />
        <CookieNotice />
        <VercelAnalyticsWithConsent />
      </body>
    </html>
  );
}
