import type { MetadataRoute } from "next";
import { isQuizVisible } from "@/lib/data";
import { eventPath, getEventRegionSlug, getRegionsWithVisibleEvents } from "@/lib/regions";
import { SITE_URL } from "@/lib/site-url";
import { readEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { events } = await readEvents();
  const regions = getRegionsWithVisibleEvents(events);
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/kvizy`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/liga`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/podniky`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const regionPages: MetadataRoute.Sitemap = regions
    .filter((region) => region.active || events.some((event) => isQuizVisible(event) && getEventRegionSlug(event) === region.slug))
    .map((region) => ({
      url: `${SITE_URL}/kvizy/${region.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }));

  const eventPages: MetadataRoute.Sitemap = events
    .filter(isQuizVisible)
    .map((event) => ({
      url: `${SITE_URL}${eventPath(event)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const leaguePages: MetadataRoute.Sitemap = events
    .filter((event) => event.leagueTable.length > 0 || event.pastResults.length > 0)
    .map((event) => ({
      url: `${SITE_URL}/liga/${event.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  return [...staticPages, ...regionPages, ...eventPages, ...leaguePages];
}
