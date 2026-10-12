import { NextRequest, NextResponse } from "next/server";
import { sendTeamSms } from "@/lib/sms-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    message?: unknown;
    recipients?: { name?: unknown; phone?: unknown }[];
  } | null;
  const message = typeof body?.message === "string" ? body.message : "";
  const recipients = Array.isArray(body?.recipients) ? body.recipients : [];
  const targets = recipients
    .map((item) => ({
      name: typeof item?.name === "string" ? item.name : "",
      phone: typeof item?.phone === "string" ? item.phone : "",
    }))
    .filter((item) => item.phone.trim());

  if (!message.trim() || targets.length === 0) {
    return NextResponse.json({ error: "Chýba text alebo označený tím s telefónom." }, { status: 400 });
  }

  try {
    const result = await sendTeamSms(message, targets);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SMS_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          error:
            "SMS ešte nie sú pripojené. V BulkGate si vytvor aplikáciu, do Vercelu pridaj BULKGATE_APPLICATION_ID a BULKGATE_APPLICATION_TOKEN a daj Redeploy.",
        },
        { status: 503 }
      );
    }
    if (code === "TOO_MANY") {
      return NextResponse.json({ error: "Naraz sa dá poslať najviac 40 čísel." }, { status: 400 });
    }
    if (code === "MESSAGE_TOO_LONG") {
      return NextResponse.json({ error: "Správa je príliš dlhá." }, { status: 400 });
    }
    return NextResponse.json({ error: "SMS sa nepodarilo odoslať." }, { status: 502 });
  }
}
