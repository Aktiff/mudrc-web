import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  addRegistration,
  deleteRegistrationById,
  deleteRegistrationsByIds,
  deleteRegistrationsForEvent,
  readRegistrations,
  updateRegistrationById,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const eventSlug = typeof body.eventSlug === "string" ? body.eventSlug.trim() : "";
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const teamName = typeof body.teamName === "string" ? body.teamName.trim() : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const playersRaw = body.players;

  if (!venue || !teamName) {
    return NextResponse.json({ error: "Vyplň názov tímu a podnik." }, { status: 400 });
  }

  const players =
    typeof playersRaw === "number" ? playersRaw : parseInt(String(playersRaw ?? ""), 10);
  if (!Number.isFinite(players) || players < 1 || players > 99) {
    return NextResponse.json({ error: "Počet hráčov musí byť medzi 1 a 99." }, { status: 400 });
  }

  const venueKey = venue.toLowerCase();
  const teamKey = teamName.toLowerCase();
  const { registrations } = await readRegistrations();
  const duplicate = registrations.some(
    (r) =>
      r.teamName.trim().toLowerCase() === teamKey &&
      r.venue.trim().toLowerCase() === venueKey &&
      (eventSlug ? r.eventSlug === eventSlug : true)
  );
  if (duplicate) {
    return NextResponse.json({ error: "Tím s týmto názvom je už na tomto podniku registrovaný." }, { status: 409 });
  }

  const reg = {
    id: randomUUID(),
    eventSlug,
    venue,
    teamName,
    players: String(players),
    phone: phoneRaw || "—",
    createdAt: new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" }),
  };

  try {
    await addRegistration(reg);
    return NextResponse.json({ ok: true, registration: reg });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní registrácie";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const playersRaw = body.players;

  if (!id) {
    return NextResponse.json({ error: "Chýba id registrácie" }, { status: 400 });
  }

  const players = typeof playersRaw === "number" ? playersRaw : parseInt(String(playersRaw ?? ""), 10);
  if (!Number.isFinite(players) || players < 1 || players > 99) {
    return NextResponse.json({ error: "Počet hráčov musí byť medzi 1 a 99" }, { status: 400 });
  }

  try {
    const updated = await updateRegistrationById(id, { players: String(players) });
    if (!updated) {
      return NextResponse.json({ error: "Registrácia neexistuje" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, registration: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní registrácie";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const slug = req.nextUrl.searchParams.get("slug");
  const venue = req.nextUrl.searchParams.get("venue");
  const idsParam = req.nextUrl.searchParams.get("ids");

  try {
    if (id) {
      const ok = await deleteRegistrationById(id);
      if (!ok) return NextResponse.json({ error: "Registrácia neexistuje" }, { status: 404 });
      return NextResponse.json({ ok: true, removed: 1 });
    }

    if (idsParam) {
      const ids = idsParam.split(",").map((value) => value.trim()).filter(Boolean);
      const removed = await deleteRegistrationsByIds(ids);
      return NextResponse.json({ ok: true, removed });
    }

    if (slug || venue) {
      const removed = await deleteRegistrationsForEvent(slug ?? "", venue ?? undefined);
      return NextResponse.json({ ok: true, removed });
    }

    return NextResponse.json({ error: "Chýba parameter id, ids, slug alebo venue" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri mazaní registrácie";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
