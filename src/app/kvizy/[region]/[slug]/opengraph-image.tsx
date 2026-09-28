import { OG_CONTENT_TYPE, OG_SIZE, renderBrandOgFallback, renderVenueOgImage } from "@/lib/og-image";
import { absoluteMediaUrl } from "@/lib/media-url";
import { getPublicEvent } from "@/lib/public-events";
import { isRegionSlug } from "@/lib/regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

type Props = { params: { region: string; slug: string } };

export default async function EventOpenGraphImage({ params }: Props) {
  if (!isRegionSlug(params.region)) {
    return renderBrandOgFallback();
  }

  const event = await getPublicEvent(params.region, params.slug);
  if (!event) {
    return renderBrandOgFallback();
  }

  const imageUrl = absoluteMediaUrl(event.imageUrl);
  if (imageUrl) {
    return renderVenueOgImage(imageUrl);
  }

  return renderBrandOgFallback();
}

export async function generateMetadata({ params }: Props) {
  if (!isRegionSlug(params.region)) return {};
  const event = await getPublicEvent(params.region, params.slug);
  return {
    alt: event ? `Kvíz ${event.venue}, ${event.city}` : "Mudrc kvíz",
  };
}
