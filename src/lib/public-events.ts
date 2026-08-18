import { isQuizVisible, sortEventsByDate } from "@/lib/data";
import { isValidStoredEvent } from "@/lib/event-normalize";
import { getEventRegionSlug, isRegionSlug } from "@/lib/regions";
import { readEvents } from "@/lib/storage";

export async function readPublicEvents() {
  const { events } = await readEvents();
  return sortEventsByDate(events.filter((event) => isValidStoredEvent(event) && isQuizVisible(event)));
}

export async function getPublicEvent(regionParam: string, slug: string) {
  const bySlug = await getPublicEventBySlug(slug);
  if (!bySlug || !isRegionSlug(regionParam)) return null;
  if (getEventRegionSlug(bySlug) !== regionParam) return null;
  return bySlug;
}

export async function getPublicEventBySlug(slug: string) {
  const { events } = await readEvents();
  const event = events.find((entry) => entry.slug === slug);
  if (!event || !isValidStoredEvent(event) || !isQuizVisible(event)) return null;
  return event;
}
