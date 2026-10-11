import { NextResponse } from "next/server";
import { buildFacebookEventPost } from "@/lib/facebook-event-post";
import { readAllEventsRaw } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v23.0";

function pageToken(): string {
  return process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || "";
}

function pageTarget(): string {
  return process.env.FACEBOOK_PAGE_ID?.trim() || "me";
}

async function loadEvent(slug: string) {
  const { events } = await readAllEventsRaw();
  return events.find((event) => event.slug === slug) ?? null;
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const event = await loadEvent(params.slug);
  if (!event) return NextResponse.json({ error: "Udalosť sa nenašla." }, { status: 404 });
  return NextResponse.json({
    message: buildFacebookEventPost(event),
    configured: Boolean(pageToken()),
  });
}

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const event = await loadEvent(params.slug);
  if (!event) return NextResponse.json({ error: "Udalosť sa nenašla." }, { status: 404 });

  const token = pageToken();
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Stránka ešte nie je pripojená. Do Vercelu pridaj FACEBOOK_PAGE_ACCESS_TOKEN (token stránky Mudrc) a znova nasaď projekt.",
        message: buildFacebookEventPost(event),
      },
      { status: 503 }
    );
  }

  const message = buildFacebookEventPost(event);
  const body = new URLSearchParams({ message, access_token: token });
  const target = encodeURIComponent(pageTarget());

  let graph: Response;
  try {
    graph = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${target}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return NextResponse.json({ error: "Facebook sa nepodarilo kontaktovať. Skús to znova." }, { status: 502 });
  }

  const payload = (await graph.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;
  if (!graph.ok || !payload?.id) {
    const detail = payload?.error?.message?.trim();
    return NextResponse.json(
      { error: detail ? `Facebook odmietol príspevok: ${detail}` : "Príspevok sa na stránku nepodarilo poslať." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: payload.id,
    url: `https://www.facebook.com/${payload.id}`,
  });
}
