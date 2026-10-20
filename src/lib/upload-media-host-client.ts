"use client";

type HostKind = "audio" | "video";

function messageFromResponse(res: Response, text: string, fallback: string): string {
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) return data.error;
  } catch {
    /* not JSON */
  }
  if (text.trim()) return text.slice(0, 280);
  return `${fallback} (HTTP ${res.status}).`;
}

/** Súbor ide priamo na media.mudrc.sk, nie do Vercel Blobu. */
export async function uploadFileToMediaHost(kind: HostKind, file: File): Promise<string> {
  let ticketRes: Response;
  try {
    ticketRes = await fetch("/api/admin/media-host", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Nepodarilo sa pripraviť nahratie. Skús to znova.");
    }
    throw error instanceof Error ? error : new Error("Nepodarilo sa pripraviť nahratie.");
  }

  const ticketText = await ticketRes.text();
  if (!ticketRes.ok) {
    throw new Error(messageFromResponse(ticketRes, ticketText, "Nahratie sa nepodarilo pripraviť"));
  }

  let ticket: { uploadUrl?: string; token?: string } = {};
  try {
    ticket = JSON.parse(ticketText) as { uploadUrl?: string; token?: string };
  } catch {
    throw new Error("Neplatná odpoveď pri príprave nahratia.");
  }
  if (!ticket.uploadUrl || !ticket.token) {
    throw new Error("Server nevrátil adresu nahratia.");
  }

  const form = new FormData();
  form.append("token", ticket.token);
  form.append("file", file, file.name);

  let res: Response;
  try {
    res = await fetch(ticket.uploadUrl, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Nahrávanie trvalo príliš dlho. Skús to znova.");
    }
    throw new Error("Súbor sa na hosting nepodarilo odoslať.");
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(messageFromResponse(res, text, "Súbor sa na hosting nepodarilo uložiť"));
  }

  let data: { url?: string } = {};
  try {
    data = JSON.parse(text) as { url?: string };
  } catch {
    throw new Error("Hosting nevrátil adresu súboru.");
  }
  if (!data.url) throw new Error("Hosting nevrátil adresu súboru.");
  return data.url;
}
