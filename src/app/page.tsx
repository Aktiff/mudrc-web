import HeroSection from "@/components/HeroSection";
import QuizzesSection from "@/components/QuizzesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import VenuesSection from "@/components/VenuesSection";
import CareerSection from "@/components/CareerSection";
import { buildHomepageMetadata } from "@/lib/homepage-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return buildHomepageMetadata();
}

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
