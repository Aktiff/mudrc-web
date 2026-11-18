import type { PaySeat, PayTeam } from "@/lib/pay-domain";
import { formatSeatLabel, prepaidSeatCount } from "@/lib/pay-domain";
import { formatEventDateLabel } from "@/lib/data";
import { getPayBasePath, isPayHostname, payHref, payPublicOrigin } from "@/lib/pay-config";

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

function seatsNoun(count: number): string {
  if (count === 1) return "miesto";
  if (count < 5) return "miesta";
  return "miest";
}

/**
 * Absolute captain dashboard URL for emails.
 * Prefer request host when provided; otherwise pay.mudrc.sk /t/<token>.
 */
export function absoluteCaptainTeamUrl(
  teamToken: string,
  request?: { host?: string | null; proto?: string | null }
): string {
  const token = teamToken.trim();
  const host = request?.host ?? null;
  const proto = request?.proto ?? null;
  const origin = payPublicOrigin(host, proto);
  let originHost = "";
  try {
    originHost = new URL(origin).hostname;
  } catch {
    originHost = "";
  }
  // Production emails: always land on the dedicated pay host when origin is the main site.
  if (!isPayHostname(originHost) && (process.env.VERCEL || process.env.NODE_ENV === "production")) {
    return `https://pay.mudrc.sk/t/${encodeURIComponent(token)}`;
  }
  const basePath = isPayHostname(originHost) || isPayHostname(host) ? "" : getPayBasePath(host);
  return `${origin}${payHref(basePath, `/t/${token}`)}`;
}

/**
 * After team registration: email the captain an absolute link to reopen /t/<token>
 * anytime (no login for MVP).
 */
export async function sendCaptainTeamAccessEmail(input: {
  team: PayTeam;
  teamUrl: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string; id?: string }> {
  const to = input.team.captainEmail.trim().toLowerCase();
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
  const seats = prepaidSeatCount(input.team);
  const teamUrl = input.teamUrl.trim();
  const subject = `Tvoj tím ${input.team.teamName} — odkaz na správu rezervácie`;

  const text = [
    "Tvoja rezervácia tímu — MUDRC Kvíz",
    "",
    "Rezervácia je uložená. Tento odkaz otvorí stránku tvojho tímu kedykoľvek (bez prihlásenia):",
    teamUrl,
    "",
    `Tím: ${input.team.teamName}`,
    `Miesta: ${seats}`,
    `Podnik: ${input.team.venue}${input.team.city ? `, ${input.team.city}` : ""}`,
    `Termín: ${when}`,
    "",
    "Na stránke tímu nájdeš pay-link pre kamarátov a stav platieb.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="sk">
<body style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
  <h2 style="color:#d97706;">Tvoja rezervácia tímu</h2>
  <p>Rezervácia je uložená. Tento odkaz otvorí stránku tvojho tímu <b>kedykoľvek</b> (bez prihlásenia):</p>
  <p style="margin:16px 0;"><a href="${escapeHtml(teamUrl)}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">Otvoriť stránku tímu</a></p>
  <p style="font-size:13px;word-break:break-all;color:#555;">${escapeHtml(teamUrl)}</p>
  <table style="border-collapse:collapse;margin-top:16px;">
    <tr><td style="padding:4px 12px 4px 0;"><b>Tím:</b></td><td>${escapeHtml(input.team.teamName)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Miesta:</b></td><td>${seats}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Podnik:</b></td><td>${escapeHtml(input.team.venue)}${input.team.city ? `, ${escapeHtml(input.team.city)}` : ""}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Termín:</b></td><td>${escapeHtml(when)}</td></tr>
  </table>
  <p style="margin-top:16px;color:#555;font-size:14px;">Na stránke tímu nájdeš pay-link pre kamarátov a stav platieb.</p>
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
          { name: "type", value: "pay-captain-access" },
          { name: "mock", value: "true" },
        ],
      }),
    });

    const detail = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("Captain team access Resend error:", res.status, detail);
      return { ok: false, error: `Resend ${res.status}: ${detail || "neznáma chyba"}` };
    }

    let id: string | undefined;
    try {
      id = JSON.parse(detail)?.id;
    } catch {
      id = undefined;
    }
    console.info("Captain team access email accepted by Resend:", id ?? detail);
    return { ok: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba";
    console.error("sendCaptainTeamAccessEmail failed:", error);
    return { ok: false, error: message };
  }
}

/**
 * Confirmation to the payer after mock (or future real) checkout.
 * One email covers N seats when quantity > 1.
 * Uses the same Resend path as registration notifications.
 */
export async function sendPaymentConfirmationEmail(input: {
  team: PayTeam;
  /** Single-seat legacy callers */
  seat?: PaySeat;
  /** Multi-seat summary (preferred when paying N at once) */
  seats?: PaySeat[];
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

  const seats =
    input.seats && input.seats.length > 0
      ? input.seats
      : input.seat
        ? [input.seat]
        : [];
  if (seats.length === 0) {
    return { ok: false, error: "Chýbajú miesta na potvrdenie." };
  }

  const from = getFromAddress();
  const fromEmail = extractEmailAddress(from);
  const when = `${formatEventDateLabel(input.team.quizDate)} · ${input.team.quizTime}`;
  const count = seats.length;
  const totalEur = Math.round(seats.reduce((sum, s) => sum + s.amountEur, 0) * 100) / 100;
  const amount = `${totalEur} €`;
  const seatSummary =
    count === 1
      ? formatSeatLabel(seats[0])
      : `${count} ${seatsNoun(count)} (${seats.map((s) => formatSeatLabel(s)).join(", ")})`;
  const subject =
    count === 1
      ? `Tvoje potvrdenie platby: ${formatSeatLabel(seats[0])} · ${input.team.teamName}`
      : `Tvoje potvrdenie platby: ${count} ${seatsNoun(count)} · ${input.team.teamName}`;

  const bodyLead =
    count === 1
      ? "Ďakujeme za registráciu. Platbu sme prijali a vaše miesto v tíme je rezervované."
      : `Ďakujeme za registráciu. Platbu sme prijali za ${count} ${seatsNoun(count)} — všetky sú rezervované.`;

  const text = [
    "Potvrdenie tvojej platby — MUDRC Kvíz",
    "",
    bodyLead,
    "",
    `Tím: ${input.team.teamName}`,
    `Miesta: ${seatSummary}`,
    `Suma: ${amount}`,
    `Podnik: ${input.team.venue}${input.team.city ? `, ${input.team.city}` : ""}`,
    `Termín: ${when}`,
    "",
    "Ukáž toto potvrdenie pri check-ine.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="sk">
<body style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
  <h2 style="color:#d97706;">Tvoja platba je potvrdená</h2>
  <p>${escapeHtml(bodyLead)}</p>
  <table style="border-collapse:collapse;">
    <tr><td style="padding:4px 12px 4px 0;"><b>Tím:</b></td><td>${escapeHtml(input.team.teamName)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Miesta:</b></td><td>${escapeHtml(seatSummary)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Suma:</b></td><td>${escapeHtml(amount)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Podnik:</b></td><td>${escapeHtml(input.team.venue)}${input.team.city ? `, ${escapeHtml(input.team.city)}` : ""}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Termín:</b></td><td>${escapeHtml(when)}</td></tr>
  </table>
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
          { name: "seats", value: String(count) },
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
