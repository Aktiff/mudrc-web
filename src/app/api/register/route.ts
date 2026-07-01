import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { addRegistration, readRegistrations } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { venue, eventSlug, teamName, players, phone } = await req.json();
  if (!venue || !teamName || !phone) {
    return NextResponse.json({ error: "Chybaju udaje." }, { status: 400 });
  }
  const reg = {
    id: randomUUID(),
    eventSlug: eventSlug ?? "",
    venue,
    teamName,
    players: String(players),
    phone: String(phone).trim(),
    createdAt: new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" }),
  };
  try {
    await addRegistration(reg);
  } catch (error) {
    console.error("addRegistration failed:", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Chyba pri ukladani registracie.", detail },
      { status: 500 }
    );
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "MUDRC Kviz <onboarding@resend.dev>",
          to: ["kontakt@mudrc.sk"],
          subject: `Nova registracia: ${teamName} - ${venue}`,
          html: `<h2>Nova registracia timu</h2><p><b>Podnik:</b> ${venue}</p><p><b>Tim:</b> ${teamName}</p><p><b>Pocet hracov:</b> ${players}</p><p><b>Telefon:</b> ${phone}</p><p><b>Cas:</b> ${reg.createdAt}</p>`,
        }),
      });
    } catch {}
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const data = await readRegistrations();
  const slug = req.nextUrl.searchParams.get("slug");
  const venue = req.nextUrl.searchParams.get("venue");
  if (slug || venue) {
    return NextResponse.json({
      registrations: data.registrations.filter((r) => {
        if (slug && r.eventSlug === slug) return true;
        if (venue && r.venue.toLowerCase() === venue.toLowerCase()) return true;
        return false;
      }),
    });
  }
  return NextResponse.json(data);
}
