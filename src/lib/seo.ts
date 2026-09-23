import type { Metadata } from "next";
import type { QuizEvent } from "@/lib/data";
import { formatEventDateLabel } from "@/lib/data";
import { eventPath, getEventRegionSlug, getRegion, type RegionSlug } from "@/lib/regions";
import { OG_IMAGE_VERSION } from "@/lib/og-image";
import { SITE_URL, absoluteUrl } from "@/lib/site-url";

export { SITE_URL, absoluteUrl };

export function parseSkDateTime(date: string, time: string): string | undefined {
  const match = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const timeMatch = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) return undefined;
  const [, hours, minutes] = timeMatch;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00+02:00`;
}

/** Titulok pre FB / OG — dátum, čas a miesto (nie generický názov webu). */
export function buildEventShareTitle(event: QuizEvent): string {
  const when = `${formatEventDateLabel(event.date)} · ${event.time}`;
  const where = `${event.venue}, ${event.city}`;
  return `Kvíz ${where} · ${when}`;
}

export function buildEventShareDescription(event: QuizEvent): string {
  const when = `${formatEventDateLabel(event.date)} o ${event.time}`;
  const place = event.address.trim()
    ? `${event.venue}, ${event.address}, ${event.city}`
    : `${event.venue}, ${event.city}`;
  return `${place} · ${when} · vstup ${event.entryFee} €/hráč · registrácia online`;
}

export function buildEventMetadata(event: QuizEvent, region: RegionSlug): Metadata {
  const path = eventPath(event);
  const pageTitle = `Kvíz ${event.venue}, ${event.city}`;
  const shareTitle = buildEventShareTitle(event);
  const shareDescription = buildEventShareDescription(event);
  const ogImagePath = `${path}/opengraph-image?v=${OG_IMAGE_VERSION}`;

  return {
    title: pageTitle,
    // Match og:description — FB often hides og:description in posts when meta description differs.
    description: shareDescription,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      title: shareTitle,
      description: shareDescription,
      url: absoluteUrl(path),
      type: "article",
      locale: "sk_SK",
      siteName: "Mudrc kvíz",
      images: [
        {
          url: ogImagePath,
          secureUrl: absoluteUrl(`${ogImagePath}`),
          width: 1200,
          height: 630,
          alt: shareDescription,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: shareDescription,
      images: [absoluteUrl(ogImagePath)],
    },
  };
}

export function buildRegionMetadata(region: RegionSlug): Metadata {
  const config = getRegion(region)!;
  const path = `/kvizy/${region}`;

  return {
    title: config.title,
    description: config.metaDescription,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      title: config.title,
      description: config.metaDescription,
      url: absoluteUrl(path),
      type: "website",
      locale: "sk_SK",
      siteName: "Mudrc kvíz",
    },
  };
}

export function buildEventJsonLd(event: QuizEvent, region: RegionSlug) {
  const regionConfig = getRegion(region)!;
  const startDate = parseSkDateTime(event.date, event.time);
  const url = absoluteUrl(eventPath(event));
  const seoDescription = `Vedomostný pub kvíz v podniku ${event.venue} (${event.city}, ${regionConfig.name}). Termín ${event.date} o ${event.time}, vstupné ${event.entryFee} € / hráč. Registruj tím online.`;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `Mudrc kvíz — ${event.venue}`,
    description: seoDescription,
    startDate,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: event.venue,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.address,
        addressLocality: event.city,
        addressCountry: "SK",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Mudrc kvíz",
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      price: String(event.entryFee),
      priceCurrency: "EUR",
      url,
      availability: "https://schema.org/InStock",
    },
    url,
    ...(event.imageUrl ? { image: [event.imageUrl] } : {}),
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function getEventRegion(event: QuizEvent, regionParam: string): RegionSlug | null {
  const region = getEventRegionSlug(event);
  if (regionParam !== region) return null;
  return region;
}
