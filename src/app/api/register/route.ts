import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  addRegistration,
  getStorageDiagnostics,
  hasPersistentStorage,
  readRegistrations,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { venue, eventSlug, teamName, players, phone } = await req.json();
  if (!venue || !teamName || !phone) {
    return NextResponse.json({ error: "Chybajú údaje." }, { status: 400 });
  }

  if (!hasPersistentStorage()) {
    return NextResponse.json(
      {
        error: "Registráciu sa nepodarilo uložiť.",
        detail:
          "Chýba úložisko. Zdarma: supabase.com → New project → SQL Editor (spusti scripts/supabase.sql) → Settings → API → skopíruj URL a service_role key → vo Verceli pridaj SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY → Redeploy.",
        storage: getStorageDiagnostics(),
      },
      { status: 500 }
    );
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
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("addRegistration failed:", error);
    const message = error instanceof Error ? error.message : "Neznáma chyba";
    return NextResponse.json(
      {
        error: "Registráciu sa nepodarilo uložiť.",
        detail: message,
        storage: getStorageDiagnostics(),
      },
      { status: 500 }
    );
  }
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
