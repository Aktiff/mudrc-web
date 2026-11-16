import HeroSection from "@/components/HeroSection";
import QuizzesSection from "@/components/QuizzesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import VenuesSection from "@/components/VenuesSection";
import CareerSection from "@/components/CareerSection";
import JsonLd from "@/components/JsonLd";
import { isQuizVisible } from "@/lib/data";
import { publicQuizCards } from "@/lib/future-quizzes";
import { buildHomepageMetadata } from "@/lib/homepage-metadata";
import { readPublicEvents } from "@/lib/public-events";
import { eventPath } from "@/lib/regions";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateMetadata() {
  return buildHomepageMetadata();
}

export default async function Home() {
  const cards = publicQuizCards((await readPublicEvents()).filter(isQuizVisible));
  const quizList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Najbližšie kvízy",
    itemListElement: cards.map((card, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${card.quizType} · ${card.venue}, ${card.city}`,
      url: absoluteUrl(
        card.termQuery ? `${eventPath(card)}?termin=${encodeURIComponent(card.termQuery)}` : eventPath(card)
      ),
    })),
  };

  return (
    <>
      <JsonLd data={[buildOrganizationJsonLd(), buildWebSiteJsonLd(), quizList]} />
      <HeroSection />
      <QuizzesSection />
      <HowItWorksSection />
      <VenuesSection />
      <CareerSection />
    </>
  );
}
