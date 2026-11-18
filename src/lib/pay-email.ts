import type { PaySeat, PayTeam } from "@/lib/pay-domain";
import { formatSeatLabel } from "@/lib/pay-domain";
import { formatEventDateLabel } from "@/lib/data";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function extractEmailAddress(from: string): string {
  const angle = from.match(/<([^>]+)>/);
  if (angle) return angle[1].trim();
  return from.trim();
}

function getFromAddress(): string {
  const raw = process.env.REGISTRATION_EMAIL_FROM?.trim();
  const email = raw ? stripEnvQuotes(raw) : "kontakt@mudrc.sk";
  if (email.includes("<")) return email;
  return `Mudrc Kvíz <${extractEmailAddress(email)}>`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getPayEmailDiagnostics() {
  const from = getFromAddress();
  return {
    configured: !!process.env.RESEND_API_KEY,
    from,
    fromEmail: extractEmailAddress(from),
  };
}

/**
 * Confirmation to the payer after mock (or future real) checkout.
 * Uses the same Resend path as registration notifications.
 */
export async function sendPaymentConfirmationEmail(input: {
  team: PayTeam;
  seat: PaySeat;
  toEmail: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string; id?: string }> {
  const to = input.toEmail.trim().toLowerCase();
  if (!to || !isValidEmail(to)) {
    return { ok: true, skipped: true };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "RESEND_API_KEY nie je nastavený vo Verceli (po pridaní treba Redeploy).",
    };
  }

  const from = getFromAddress();
  const fromEmail = extractEmailAddress(from);
  const when = `${formatEventDateLabel(input.team.quizDate)} · ${input.team.quizTime}`;
  const seatLabel = formatSeatLabel(input.seat);
  const amount = `${input.seat.amountEur} €`;
  const subject = `Potvrdenie platby: ${seatLabel} · ${input.team.teamName}`;

  const text = [
    "Potvrdenie platby — MUDRC Kvíz (mock staging)",
    "",
    `Tím: ${input.team.teamName}`,
    `Miesto: ${seatLabel}`,
    `Suma: ${amount}`,
    `Podnik: ${input.team.venue}${input.team.city ? `, ${input.team.city}` : ""}`,
    `Termín: ${when}`,
    input.seat.payerName ? `Platiteľ: ${input.seat.payerName}` : "",
    "",
    "Toto je testovacie potvrdenie z pay.mudrc.sk — platba prebehla ako mock (bez skutočnej karty).",
    "Ukáž toto potvrdenie pri check-ine.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="sk">
<body style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
  <h2 style="color:#d97706;">Platba potvrdená</h2>
  <p>Ďakujeme — tvoje miesto je rezervované.</p>
  <table style="border-collapse:collapse;">
    <tr><td style="padding:4px 12px 4px 0;"><b>Tím:</b></td><td>${escapeHtml(input.team.teamName)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Miesto:</b></td><td>${escapeHtml(seatLabel)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Suma:</b></td><td>${escapeHtml(amount)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Podnik:</b></td><td>${escapeHtml(input.team.venue)}${input.team.city ? `, ${escapeHtml(input.team.city)}` : ""}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Termín:</b></td><td>${escapeHtml(when)}</td></tr>
    ${input.seat.payerName ? `<tr><td style="padding:4px 12px 4px 0;"><b>Platiteľ:</b></td><td>${escapeHtml(input.seat.payerName)}</td></tr>` : ""}
  </table>
  <p style="margin-top:16px;color:#666;font-size:12px;">
    Mock staging pay.mudrc.sk — bez skutočnej karty. MUDRC Kvíz
  </p>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: fromEmail,
        subject,
        text,
        html,
        tags: [
          { name: "type", value: "pay-confirmation" },
          { name: "mock", value: "true" },
        ],
      }),
    });

    const detail = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("Pay confirmation Resend error:", res.status, detail);
      return { ok: false, error: `Resend ${res.status}: ${detail || "neznáma chyba"}` };
    }

    let id: string | undefined;
    try {
      id = JSON.parse(detail)?.id;
    } catch {
      id = undefined;
    }
    console.info("Pay confirmation email accepted by Resend:", id ?? detail);
    return { ok: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba";
    console.error("sendPaymentConfirmationEmail failed:", error);
    return { ok: false, error: message };
  }
}
