import { notFound } from "next/navigation";
import { isQuizVisible } from "@/lib/data";
import { readEvents } from "@/lib/storage";
import EventDetailPage from "@/components/EventDetailPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: { slug: string } }) {
  const { events } = await readEvents();
  const event = events.find((entry) => entry.slug === params.slug);
  if (!event || !isQuizVisible(event)) notFound();
  return <EventDetailPage event={event} />;
}
