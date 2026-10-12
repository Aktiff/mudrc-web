import { NextResponse } from "next/server";
import { buildFacebookEventPost } from "@/lib/facebook-event-post";
import { readAllEventsRaw } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v23.0";

function pageToken(): string {
  return process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || "";
}

function normalizePageName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("sk")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isMudrcQuizPage(page: { name?: string; username?: string }): boolean {
  const username = (page.username ?? "").trim().toLowerCase();
  if (username === "mudrc.sk") return true;
  return normalizePageName(page.name ?? "") === "mudrc kviz";
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
      pageName: posted.pageName,
      url: `https://www.facebook.com/${posted.id}`,
    });
  } catch {
    return NextResponse.json({ error: "Facebook sa nepodarilo kontaktovať. Skús to znova." }, { status: 502 });
  }
}

type GraphPage = { id?: string; name?: string; username?: string; access_token?: string };
type GraphPayload = GraphPage & {
  error?: { message?: string; code?: number };
  data?: GraphPage[];
  paging?: { next?: string };
};

const MISSING_PAGE =
  "Príspevok sa nikam neposlal. Tento token je osobný: Facebook pod ním vracia tvoje meno, nie stránku Mudrc kvíz. V Exploreri zaškrtni aj business_management, klikni Generate Access Token a potom Edit settings. Zaškrtni Mudrc kvíz. V odpovedi me/accounts nájdi objekt Mudrc kvíz a do Vercelu vlož access_token z vnútra toho objektu. Potom daj Redeploy.";

function publishError(payload: GraphPayload | null): string {
  const detail = payload?.error?.message?.trim() ?? "";
  if (payload?.error?.code === 200 || detail.includes("(#200)") || detail.includes("pages_manage_posts")) {
    return "Token stránky Mudrc kvíz nemá právo publikovať. V Exploreri pridaj pages_manage_posts a pages_read_engagement, znova vygeneruj token a v me/accounts vezmi access_token pri Mudrc kvíz.";
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

async function graphGet(token: string, path: string, fields: string): Promise<GraphPayload | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  return (await response.json().catch(() => null)) as GraphPayload | null;
}

async function listGraphPages(token: string, path: string): Promise<GraphPage[]> {
  const pages: GraphPage[] = [];
  let next: string | null =
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}?fields=id,name,username,access_token&limit=100&access_token=${encodeURIComponent(token)}`;
  for (let page = 0; page < 5 && next; page += 1) {
    const response = await fetch(next, { signal: AbortSignal.timeout(20000) });
    const payload = (await response.json().catch(() => null)) as GraphPayload | null;
    pages.push(...(payload?.data ?? []));
    next = payload?.paging?.next ?? null;
  }
  return pages;
}

async function mudrcPageToken(token: string): Promise<GraphPage | null> {
  const withToken = await graphGet(token, "mudrc.sk", "id,name,username,access_token");
  const page = withToken?.id ? withToken : await graphGet(token, "mudrc.sk", "id,name,username");
  if (!page?.id || !isMudrcQuizPage(page) || !page.access_token) return null;
  return page;
}

async function mudrcPageFromBusiness(token: string): Promise<GraphPage | null> {
  const businesses = await graphGet(token, "me/businesses", "id,name");
  for (const business of (businesses?.data ?? []).slice(0, 10)) {
    if (!business.id) continue;
    const owned = await listGraphPages(token, `${business.id}/owned_pages`);
    const client = await listGraphPages(token, `${business.id}/client_pages`);
    const found = [...owned, ...client].find((page) => isMudrcQuizPage(page) && page.id && page.access_token);
    if (found?.id && found.access_token) return found;
  }
  return null;
}

async function currentTokenPage(token: string): Promise<GraphPage | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me`);
  url.searchParams.set("fields", "id,name,username");
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const payload = (await response.json().catch(() => null)) as GraphPage | null;
  if (!payload?.id || payload.name === undefined && !payload.username) return null;
  return payload;
}

async function publishToMudrcPage(
  token: string,
  message: string
): Promise<{ id?: string; pageName?: string; error: string }> {
  const pages = await listGraphPages(token, "me/accounts");
  const managed = pages.find((page) => isMudrcQuizPage(page) && page.id && page.access_token);
  const direct = managed?.access_token ? managed : await mudrcPageToken(token);
  const page = direct?.access_token ? direct : await mudrcPageFromBusiness(token);
  if (page?.id && page.access_token) {
    const payload = await publishFeed(page.id, page.access_token, message);
    if (payload?.id) return { id: payload.id, pageName: page.name || "Mudrc kvíz", error: "" };
    return { error: publishError(payload) };
  }

  const self = await currentTokenPage(token);
  if (self?.id && isMudrcQuizPage(self)) {
    const payload = await publishFeed(self.id, token, message);
    if (payload?.id) return { id: payload.id, pageName: self.name || "Mudrc kvíz", error: "" };
    return { error: publishError(payload) };
  }

  return { error: MISSING_PAGE };
}
