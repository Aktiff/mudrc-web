import type { Metadata } from "next";
import HeroSection from "@/components/HeroSection";
import QuizzesSection from "@/components/QuizzesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import VenuesSection from "@/components/VenuesSection";
import CareerSection from "@/components/CareerSection";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Mudrc kvíz – vedomostné pub kvízy",
  description:
    "Vedomostné pub kvízy plné zábavy na Slovensku. Registruj tím, otestuj vedomosti a zabav sa s priateľmi vo svojom obľúbenom podniku.",
  alternates: { canonical: absoluteUrl("/") },
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
