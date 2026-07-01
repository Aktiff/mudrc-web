import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { addRegistration, getBlobStorageDiagnostics, hasBlobStorage, readRegistrations } from "@/lib/storage";
import { sendRegistrationEmail } from "@/lib/registration-email";

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

  let storedInBlob = false;

  if (hasBlobStorage()) {
    try {
      await addRegistration(reg);
      storedInBlob = true;
    } catch (error) {
      console.error("addRegistration failed:", error);
    }
  }

  const emailSent = await sendRegistrationEmail(reg, players);

  if (storedInBlob) {
    return NextResponse.json({ ok: true, storedInBlob: true, emailSent });
  }

  if (emailSent) {
    return NextResponse.json({
      ok: true,
      storedInBlob: false,
      emailSent: true,
      message: "Registracia odoslana emailom. Admin panel ju zobrazi az po pripojeni Vercel Blob storage.",
    });
  }

  const storage = getBlobStorageDiagnostics();
  return NextResponse.json(
    {
      error: "Registraciu sa nepodarilo ulozit.",
      detail:
        "Chyba konfiguracie storage. Vo Verceli: Storage → Blob → Connect to Project (Production) → Redeploy. Alebo nastav RESEND_API_KEY pre emailovy fallback.",
      storage,
    },
    { status: 500 }
  );
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
