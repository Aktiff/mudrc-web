import type { Metadata } from "next";
import { isLeagueVisible } from "@/lib/data";
import { buildPageMetadata } from "@/lib/seo";
import { readEvents } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LayoutProps = { params: { slug: string }; children: React.ReactNode };

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { events } = await readEvents();
  const event = events.find((entry) => entry.slug === params.slug);
  if (!event || !isLeagueVisible(event)) {
    return { title: "Liga", robots: { index: false, follow: false } };
  }
  return buildPageMetadata({
    title: `Liga ${event.venue}`,
    description: `Ligová tabuľka a história kvízov v podniku ${event.venue}, ${event.city}. Poradie tímov a body sezóny.`,
    path: `/liga/${event.slug}`,
  });
}

export default function LeagueEventLayout({ children }: LayoutProps) {
  return children;
}
