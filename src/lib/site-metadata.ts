import type { Metadata } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site-url";

export const DEFAULT_SITE_TITLE = "Mudrc Kvíz – Vedomostné pub kvízy";
export const DEFAULT_SITE_DESCRIPTION =
  "Vedomostné pub kvízy plné zábavy na Slovensku. Registruj tím, otestuj vedomosti a zabav sa s priateľmi vo svojom obľúbenom podniku.";

export const defaultSiteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Mudrc kvíz",
    template: "%s | Mudrc",
  },
  description: DEFAULT_SITE_DESCRIPTION,
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "sk_SK",
    url: absoluteUrl("/"),
    siteName: "Mudrc kvíz",
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        secureUrl: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "Mudrc Kvíz – Vedomostné pub kvízy",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: [absoluteUrl("/opengraph-image")],
  },
};
