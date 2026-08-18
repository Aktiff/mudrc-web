import { revalidatePath } from "next/cache";
import type { QuizEvent } from "@/lib/data";
import { getEventRegionSlug, REGION_OPTIONS } from "@/lib/regions";
import { readEvents } from "@/lib/storage";

/** Zoznamy kvízov (homepage, /kvizy, regióny) — volať po každej zmene udalostí. */
export function revalidatePublicListings() {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/kvizy");
  for (const region of REGION_OPTIONS) {
    revalidatePath(`/kvizy/${region.slug}`);
  }
  revalidatePath("/liga");
  revalidatePath("/api/events");
  revalidatePath("/sitemap.xml");
}

export async function revalidatePublicEventPaths(slug: string) {
  revalidatePublicListings();

  const { events } = await readEvents();
  const event = events.find((entry) => entry.slug === slug);
  const region = event ? getEventRegionSlug(event) : "prievidza";

  revalidatePath(`/kvizy/${region}/${slug}`);
  revalidatePath(`/udalosti/${slug}`);
  revalidatePath(`/liga/${slug}`);
  revalidatePath(`/api/events/${slug}`);
}

/** Po vytvorení novej udalosti — bez čakania na cache (region z uloženého objektu). */
export function revalidateAfterNewEvent(event: Pick<QuizEvent, "slug" | "regionSlug">) {
  revalidatePublicListings();
  const region = getEventRegionSlug(event);
  revalidatePath(`/kvizy/${region}/${event.slug}`);
  revalidatePath(`/udalosti/${event.slug}`);
  revalidatePath(`/liga/${event.slug}`);
  revalidatePath(`/api/events/${event.slug}`);
}
