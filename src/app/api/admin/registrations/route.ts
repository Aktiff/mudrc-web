import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import { registrationOnTerm } from "@/lib/future-quizzes";
import {
  isPayRegistrationId,
  mergeRegistrationsWithPayBookings,
  payTeamIdFromRegistrationId,
} from "@/lib/pay-admin";
import {
  cancelPayTeamById,
  cancelPayTeamsByIds,
  readPayTeams,
  scrubStrayMockPayTeamsOffRealEvents,
} from "@/lib/pay-storage";
import {
  addRegistration,
  deleteRegistrationById,
  deleteRegistrationsByIds,
  deleteRegistrationsForEvent,
  readRegistrations,
  updateRegistrationById,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } as const;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Neautorizované" }, { status: 401 });
  }

  // Drop mock/staging pay teams that landed on real venues (e.g. Alipub).
  await scrubStrayMockPayTeamsOffRealEvents().catch((error) => {
    console.error("scrubStrayMockPayTeamsOffRealEvents failed:", error);
  });

  const [{ registrations }, payTeams] = await Promise.all([readRegistrations(), readPayTeams()]);
  const slug = req.nextUrl.searchParams.get("slug");
  const venue = req.nextUrl.searchParams.get("venue");
  const quizDate = req.nextUrl.searchParams.get("quizDate") ?? req.nextUrl.searchParams.get("date");
  if (slug || venue) {
    return NextResponse.json(
      {
        registrations: mergeRegistrationsWithPayBookings(registrations, payTeams, {
          slug: slug ?? "",
          venue: venue ?? "",
          quizDate: quizDate ?? "",
        }),
      },
      { headers: NO_STORE }
    );
  }
  return NextResponse.json(
    { registrations: mergeRegistrationsWithPayBookings(registrations, payTeams) },
    { headers: NO_STORE }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const eventSlug = typeof body.eventSlug === "string" ? body.eventSlug.trim() : "";
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const teamName = typeof body.teamName === "string" ? body.teamName.trim() : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const quizDate = typeof body.quizDate === "string" ? body.quizDate.trim() : "";
  const eventDate = typeof body.eventDate === "string" ? body.eventDate.trim() : "";
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
  const termDate = quizDate || eventDate;
  const duplicate = registrations.some((r) => {
    if (r.teamName.trim().toLowerCase() !== teamKey) return false;
    if (r.venue.trim().toLowerCase() !== venueKey) return false;
    if (eventSlug && r.eventSlug !== eventSlug) return false;
    if (!termDate) return true;
    return registrationOnTerm(r, termDate, eventDate || termDate);
  });
  if (duplicate) {
    return NextResponse.json({ error: "Tím s týmto názvom je už na tomto termíne registrovaný." }, { status: 409 });
  }

  const reg = {
    id: randomUUID(),
    eventSlug,
    venue,
    teamName,
    players: String(players),
    phone: phoneRaw || "—",
    createdAt: new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" }),
    ...(termDate ? { quizDate: termDate } : {}),
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
  const hasPlayers = body.players !== undefined && body.players !== null && body.players !== "";
  const hasQuizDate = typeof body.quizDate === "string";

  if (!id) {
    return NextResponse.json({ error: "Chýba id registrácie" }, { status: 400 });
  }
  if (isPayRegistrationId(id)) {
    return NextResponse.json(
      { error: "Predplatné rezervácie upravuj cez pay dashboard tímu." },
      { status: 400 }
    );
  }
  if (!hasPlayers && !hasQuizDate) {
    return NextResponse.json({ error: "Chýba úprava registrácie" }, { status: 400 });
  }

  const patch: { players?: string; quizDate?: string } = {};
  if (hasPlayers) {
    const players = typeof body.players === "number" ? body.players : parseInt(String(body.players ?? ""), 10);
    if (!Number.isFinite(players) || players < 1 || players > 99) {
      return NextResponse.json({ error: "Počet hráčov musí byť medzi 1 a 99" }, { status: 400 });
    }
    patch.players = String(players);
  }

  if (hasQuizDate) {
    const quizDate = body.quizDate.trim();
    const eventDate = typeof body.eventDate === "string" ? body.eventDate.trim() : "";
    if (!quizDate) {
      return NextResponse.json({ error: "Chýba termín" }, { status: 400 });
    }
    const { registrations } = await readRegistrations();
    const current = registrations.find((reg) => reg.id === id);
    if (!current) {
      return NextResponse.json({ error: "Registrácia neexistuje" }, { status: 404 });
    }
    const nearest = eventDate || quizDate;
    const teamKey = current.teamName.trim().toLowerCase();
    const venueKey = (current.venue ?? "").trim().toLowerCase();
    const duplicate = registrations.some((reg) => {
      if (reg.id === id) return false;
      if (reg.teamName.trim().toLowerCase() !== teamKey) return false;
      if ((reg.venue ?? "").trim().toLowerCase() !== venueKey) return false;
      if (current.eventSlug && reg.eventSlug && reg.eventSlug !== current.eventSlug) return false;
      return registrationOnTerm(reg, quizDate, nearest);
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Tím s týmto názvom je už na tomto termíne registrovaný." },
        { status: 409 }
      );
    }
    patch.quizDate = quizDate;
  }

  try {
    const updated = await updateRegistrationById(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Registrácia neexistuje" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, registration: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní registrácie";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function idsFromDeleteRequest(req: NextRequest): Promise<string[]> {
  const fromQuery = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return fromQuery;
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const fromBody = Array.isArray(body?.ids)
    ? body.ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  return Array.from(new Set([...fromQuery, ...fromBody]));
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const slug = req.nextUrl.searchParams.get("slug");
  const venue = req.nextUrl.searchParams.get("venue");
  const ids = id ? [] : await idsFromDeleteRequest(req);

  try {
    if (id) {
      const payTeamId = payTeamIdFromRegistrationId(id);
      if (payTeamId) {
        const cancelled = await cancelPayTeamById(payTeamId);
        if (!cancelled) return NextResponse.json({ error: "Predplatná rezervácia neexistuje" }, { status: 404 });
        return NextResponse.json({ ok: true, removed: 1, id, source: "pay" });
      }
      const ok = await deleteRegistrationById(id);
      if (!ok) return NextResponse.json({ error: "Registrácia neexistuje" }, { status: 404 });
      return NextResponse.json({ ok: true, removed: 1, id });
    }

    if (ids.length > 0) {
      const classicIds = ids.filter((value) => !isPayRegistrationId(value));
      const payTeamIds = ids
        .map((value) => payTeamIdFromRegistrationId(value))
        .filter((value): value is string => Boolean(value));
      const [removedClassic, removedPay] = await Promise.all([
        classicIds.length > 0 ? deleteRegistrationsByIds(classicIds) : Promise.resolve(0),
        payTeamIds.length > 0 ? cancelPayTeamsByIds(payTeamIds) : Promise.resolve(0),
      ]);
      return NextResponse.json({
        ok: true,
        removed: removedClassic + removedPay,
        ids: [...classicIds, ...payTeamIds.map((teamId) => `pay:${teamId}`)],
      });
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
