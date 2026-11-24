import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  getStorageDiagnostics,
  hasPersistentStorage,
  readEvents,
  readRegistrations,
  upsertRegistration,
  type Registration,
} from "@/lib/storage";
import { isRegistrationOpen } from "@/lib/data";
import { isExternalEvent } from "@/lib/event-normalize";
import { findFutureQuiz, futureQuizMatchesDate } from "@/lib/future-quizzes";
import { sendRegistrationEmail } from "@/lib/registration-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { venue, eventSlug, teamName, players, phone, quizDate } = await req.json();
  if (!venue || !teamName || !phone) {
    return NextResponse.json({ error: "Chybajú údaje." }, { status: 400 });
  }

  const slug = String(eventSlug ?? "").trim();
  const term = typeof quizDate === "string" ? quizDate.trim() : "";
  let storedQuizDate = "";
  let nearestDate = "";
  if (slug) {
    const { events } = await readEvents();
    const event = events.find((entry) => entry.slug === slug);
    if (event) {
      if (isExternalEvent(event)) {
        return NextResponse.json(
          { error: "Táto udalosť má registráciu mimo mudrc.sk." },
          { status: 403 }
        );
      }
      nearestDate = event.date;
      const extra = term ? findFutureQuiz(event, term) : null;
      const isNearest = !term || futureQuizMatchesDate({ id: "", date: event.date }, term);
      if (extra) {
        if (extra.registrationOpen === false) {
          return NextResponse.json({ error: "Registrácie na tento termín sú uzavreté." }, { status: 403 });
        }
        storedQuizDate = extra.date;
      } else if (isNearest) {
        if (!isRegistrationOpen(event)) {
          return NextResponse.json({ error: "Registrácie sú uzavreté — kvíz je plný." }, { status: 403 });
        }
        storedQuizDate = event.date;
      } else {
        return NextResponse.json({ error: "Tento termín v podniku nie je." }, { status: 400 });
      }
    }
  }

  if (!hasPersistentStorage()) {
    return NextResponse.json(
      {
        error: "Registráciu sa nepodarilo uložiť.",
        detail: "Chýba úložisko Blob. Vo Verceli skontroluj BLOB_STORE_ID alebo BLOB_READ_WRITE_TOKEN a sprav Redeploy.",
        storage: getStorageDiagnostics(),
      },
      { status: 500 }
    );
  }

  const reg: Registration = {
    id: randomUUID(),
    eventSlug: eventSlug ?? "",
    venue,
    teamName: String(teamName).trim(),
    players: String(players),
    phone: String(phone).trim(),
    createdAt: new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" }),
    ...(storedQuizDate ? { quizDate: storedQuizDate } : term ? { quizDate: term } : {}),
  };

  let saved: Registration = reg;
  try {
    // Same team + venue + term overwrites the previous row (no duplicate in admin).
    const upserted = await upsertRegistration(reg, {
      nearestDate: nearestDate || storedQuizDate || term || undefined,
    });
    saved = upserted.registration;
  } catch (error) {
    console.error("upsertRegistration failed:", error);
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

  const emailResult = await sendRegistrationEmail(saved);
  if (!emailResult.ok) {
    console.warn("Registration saved but notification email was not sent:", saved.id, emailResult.error);
  }

  return NextResponse.json({
    ok: true,
    emailSent: emailResult.ok,
    emailId: emailResult.id,
    emailWarning: emailResult.ok
      ? undefined
      : emailResult.error ?? "Notifikačný e-mail sa nepodarilo odoslať.",
  });
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
