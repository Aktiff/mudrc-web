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

  try {
    const posted = await publishToMudrcPage(token, message);
    if (!posted.id) {
      return NextResponse.json({ error: posted.error }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      id: posted.id,
      url: `https://www.facebook.com/${posted.id}`,
    });
  } catch {
    return NextResponse.json({ error: "Facebook sa nepodarilo kontaktovať. Skús to znova." }, { status: 502 });
  }
}

type GraphPage = { id?: string; name?: string; access_token?: string };
type GraphPayload = { id?: string; error?: { message?: string; code?: number }; data?: GraphPage[] };

function permissionError(): string {
  return "Tento token nemá právo písať na stránku. V Graph API Exploreri pridaj pages_manage_posts a pages_read_engagement, daj Generate Access Token, zavolaj me/accounts a do Vercelu vlož access_token, ktorý je pri stránke Mudrc. Potom daj Redeploy.";
}

function publishError(payload: GraphPayload | null): string {
  const detail = payload?.error?.message?.trim() ?? "";
  if (payload?.error?.code === 200 || detail.includes("(#200)") || detail.includes("pages_manage_posts")) {
    return permissionError();
  }
  return detail ? `Facebook odmietol príspevok: ${detail}` : "Príspevok sa na stránku nepodarilo poslať.";
}

async function publishFeed(pageId: string, token: string, message: string): Promise<GraphPayload | null> {
  const body = new URLSearchParams({ message, access_token: token });
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20000),
  });
  return (await response.json().catch(() => null)) as GraphPayload | null;
}

async function resolveMudrcPage(token: string): Promise<{ id: string; token: string } | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token");
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const payload = (await response.json().catch(() => null)) as GraphPayload | null;
  const pages = payload?.data ?? [];
  const wanted = process.env.FACEBOOK_PAGE_ID?.trim();
  const page =
    pages.find((item) => wanted && item.id === wanted) ??
    pages.find((item) => (item.name ?? "").toLowerCase().includes("mudrc")) ??
    (pages.length === 1 ? pages[0] : undefined);
  if (!page?.id || !page.access_token) return null;
  return { id: page.id, token: page.access_token };
}

async function publishToMudrcPage(token: string, message: string): Promise<{ id?: string; error: string }> {
  const configuredId = pageTarget();
  let payload = await publishFeed(configuredId, token, message);
  if (payload?.id) return { id: payload.id, error: "" };

  const page = await resolveMudrcPage(token);
  if (page && (page.token !== token || page.id !== configuredId)) {
    payload = await publishFeed(page.id, page.token, message);
    if (payload?.id) return { id: payload.id, error: "" };
  }

  return { error: publishError(payload) };
}
