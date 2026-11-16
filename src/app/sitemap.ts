import type { MetadataRoute } from "next";
import { isLeagueVisible, isQuizVisible } from "@/lib/data";
import { visiblePublicNights } from "@/lib/future-quizzes";
import { normalizeDateKey } from "@/lib/quiz-result-key";
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
    { url: `${SITE_URL}/ochrana-udajov`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/vymazanie-udajov`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const regionPages: MetadataRoute.Sitemap = regions
    .filter((region) => region.active || events.some((event) => isQuizVisible(event) && getEventRegionSlug(event) === region.slug))
    .map((region) => ({
      url: `${SITE_URL}/kvizy/${region.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }));

  const eventPages: MetadataRoute.Sitemap = events.filter(isQuizVisible).flatMap((event) => {
    const base = {
      url: `${SITE_URL}${eventPath(event)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    };
    const terms = visiblePublicNights(event)
      .filter((night) => night.extraId)
      .map((night) => ({
        url: `${SITE_URL}${eventPath(event)}?termin=${encodeURIComponent(night.date)}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }));
    return [base, ...terms];
  });

  const leaguePages: MetadataRoute.Sitemap = events.filter(isLeagueVisible).flatMap((event) => {
    const table = {
      url: `${SITE_URL}/liga/${event.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    };
    const seen = new Set<string>();
    const nights = event.pastResults
      .filter((result) => result.teams && result.teams.length > 0 && result.date?.trim())
      .map((result) => `${SITE_URL}/liga/${event.slug}/${normalizeDateKey(result.date)}`)
      .filter((url) => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      })
      .map((url) => ({
        url,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.45,
      }));
    return [table, ...nights];
  });

  return [...staticPages, ...regionPages, ...eventPages, ...leaguePages];
}
