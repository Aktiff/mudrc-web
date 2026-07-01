import { notFound, redirect } from "next/navigation";
import { getEventRegionSlug } from "@/lib/regions";
import { getPublicEventBySlug } from "@/lib/public-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LegacyEventRedirect({ params }: { params: { slug: string } }) {
  const event = await getPublicEventBySlug(params.slug);
  if (!event) notFound();
  redirect(`/kvizy/${getEventRegionSlug(event)}/${params.slug}`);
}
