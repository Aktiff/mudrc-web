import { smsPreview, toSmsNumber } from "@/lib/sms-number";

const ENDPOINTS = [
  "https://portal.bulkgate.com/api/1.0/simple/transactional",
  "https://backup1.bulkgate.com/api/1.0/simple/transactional",
];

export type SmsTarget = { name: string; phone: string };

type SmsFailure = { name: string; error: string };

function gatewayError(payload: { error?: string; type?: string } | null): string {
  const detail = payload?.error?.trim() || payload?.type?.trim() || "";
  const lower = detail.toLowerCase();
  if (lower.includes("credit") || lower.includes("low credit") || lower.includes("insufficient")) {
    return "Na BulkGate došiel kredit.";
  }
  if (lower.includes("unknown identity") || lower.includes("unauthorized") || lower.includes("application_token")) {
    return "BulkGate ID alebo token nesedí.";
  }
  if (lower.includes("phone") || lower.includes("number") || lower.includes("invalid")) {
    return "Číslo sa nedá poslať.";
  }
  return detail ? `BulkGate: ${detail.slice(0, 180)}` : "SMS sa nepodarilo odoslať.";
}

async function postSms(body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  let lastError = "SMS sa nepodarilo odoslať.";
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { status?: string };
        error?: string;
        type?: string;
      } | null;
      if (response.ok && payload?.data?.status) return { ok: true };
      const error = gatewayError(payload);
      if (response.status >= 400 && response.status < 500) return { ok: false, error };
      lastError = error;
    } catch {
      lastError = "BulkGate neodpovedá. Skús to znova.";
    }
  }
  return { ok: false, error: lastError };
}

export async function sendTeamSms(
  message: string,
  targets: SmsTarget[]
): Promise<{ sent: number; failed: SmsFailure[] }> {
  const applicationId = process.env.BULKGATE_APPLICATION_ID?.trim() || "";
  const applicationToken = process.env.BULKGATE_APPLICATION_TOKEN?.trim() || "";
  if (!applicationId || !applicationToken) {
    throw new Error("SMS_NOT_CONFIGURED");
  }

  const text = message.trim();
  const preview = smsPreview(text);
  if (!text) throw new Error("EMPTY_MESSAGE");
  if (text.length > preview.max) throw new Error("MESSAGE_TOO_LONG");

  const seen = new Set<string>();
  const queue: { name: string; number: string }[] = [];
  const failed: SmsFailure[] = [];
  for (const target of targets) {
    const number = toSmsNumber(target.phone);
    const name = target.name.trim() || "Tím";
    if (!number) {
      failed.push({ name, error: "Číslo sa nedá poslať." });
      continue;
    }
    if (seen.has(number)) continue;
    seen.add(number);
    queue.push({ name, number });
  }
  if (queue.length > 40) throw new Error("TOO_MANY");

  const sender = (process.env.BULKGATE_SENDER || "").replace(/[^\w ]/g, "").trim().slice(0, 11);
  const bodyBase: Record<string, unknown> = {
    application_id: /^\d+$/.test(applicationId) ? Number(applicationId) : applicationId,
    application_token: applicationToken,
    text,
    unicode: preview.unicode,
    country: "sk",
  };
  if (sender.length >= 3) {
    bodyBase.sender_id = "gText";
    bodyBase.sender_id_value = sender;
  }

  let sent = 0;
  for (const item of queue) {
    const result = await postSms({ ...bodyBase, number: item.number });
    if (result.ok) sent += 1;
    else failed.push({ name: item.name, error: result.error });
  }
  return { sent, failed };
}
