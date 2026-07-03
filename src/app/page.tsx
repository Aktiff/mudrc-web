import type { Metadata } from "next";
import HeroSection from "@/components/HeroSection";
import QuizzesSection from "@/components/QuizzesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import VenuesSection from "@/components/VenuesSection";
import CareerSection from "@/components/CareerSection";
import { absoluteUrl } from "@/lib/seo";
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_TITLE } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: DEFAULT_SITE_TITLE,
  description: DEFAULT_SITE_DESCRIPTION,
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Mudrc kvíz – vedomostné pub kvízy",
      },
    ],
  },
  twitter: {
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <HeroSection />
      <QuizzesSection />
      <HowItWorksSection />
      <VenuesSection />
      <CareerSection />
    </>
  );
}
