import type { Registration } from "@/lib/storage";

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

function getNotifyEmails(): string[] {
  const raw = stripEnvQuotes(process.env.REGISTRATION_NOTIFY_EMAIL ?? "kontakt@mudrc.sk");
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
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

function buildRegistrationEmailContent(reg: Registration) {
  const venue = escapeHtml(reg.venue);
  const teamName = escapeHtml(reg.teamName);
  const phone = escapeHtml(reg.phone);
  const players = escapeHtml(String(reg.players));
  const createdAt = escapeHtml(reg.createdAt);
  const eventSlug = escapeHtml(reg.eventSlug || "—");
  const subject = `Nová registrácia: ${reg.teamName} — ${reg.venue}`;

  const text = [
    "Nová registrácia tímu — MUDRC Kvíz",
    "",
    `Podnik: ${reg.venue}`,
    `Tím: ${reg.teamName}`,
    `Počet hráčov: ${reg.players}`,
    `Telefón: ${reg.phone}`,
    `Čas registrácie: ${reg.createdAt}`,
    ...(reg.quizDate?.trim() ? [`Termín kvízu: ${reg.quizDate.trim()}`] : []),
    `Udalosť: ${reg.eventSlug || "—"}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="sk">
<body style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
  <h2 style="color:#d97706;">Nová registrácia tímu</h2>
  <table style="border-collapse:collapse;">
    <tr><td style="padding:4px 12px 4px 0;"><b>Podnik:</b></td><td>${venue}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Tím:</b></td><td>${teamName}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Počet hráčov:</b></td><td>${players}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Telefón:</b></td><td><a href="tel:${phone}">${phone}</a></td></tr>
    <tr><td style="padding:4px 12px 4px 0;"><b>Čas registrácie:</b></td><td>${createdAt}</td></tr>
    ${reg.quizDate?.trim() ? `<tr><td style="padding:4px 12px 4px 0;"><b>Termín kvízu:</b></td><td>${escapeHtml(reg.quizDate.trim())}</td></tr>` : ""}
    <tr><td style="padding:4px 12px 4px 0;"><b>Udalosť:</b></td><td>${eventSlug}</td></tr>
  </table>
  <p style="margin-top:16px;color:#666;font-size:12px;">MUDRC Kvíz — automatická správa z webu mudrc.sk</p>
</body>
</html>`;

  return { subject, text, html };
}

export function getRegistrationEmailDiagnostics() {
  const from = getFromAddress();
  const fromEmail = extractEmailAddress(from);
  const fromDomain = fromEmail.split("@")[1]?.toLowerCase() ?? "";
  return {
    configured: !!process.env.RESEND_API_KEY,
    from,
    fromEmail,
    fromDomain,
    notify: getNotifyEmails(),
  };
}

export async function sendRegistrationEmail(
  reg: Registration
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY nie je nastavený vo Verceli (po pridaní treba Redeploy)." };
  }

  const to = getNotifyEmails();
  if (!to.length) {
    return { ok: false, error: "REGISTRATION_NOTIFY_EMAIL je prázdny." };
  }

  const from = getFromAddress();
  const fromEmail = extractEmailAddress(from);
  const { subject, text, html } = buildRegistrationEmailContent(reg);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: fromEmail,
        subject,
        text,
        html,
        tags: [{ name: "type", value: "registration" }],
      }),
    });

    const detail = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("Resend API error:", res.status, detail);
      return { ok: false, error: `Resend ${res.status}: ${detail || "neznáma chyba"}` };
    }

    let id: string | undefined;
    try {
      id = JSON.parse(detail)?.id;
    } catch {
      id = undefined;
    }
    console.info("Registration email accepted by Resend:", id ?? detail);
    return { ok: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba";
    console.error("sendRegistrationEmail failed:", error);
    return { ok: false, error: message };
  }
}

export async function sendTestRegistrationEmail(): Promise<{ ok: boolean; error?: string; id?: string }> {
  return sendRegistrationEmail({
    id: "test",
    eventSlug: "test",
    venue: "Test podnik",
    teamName: "Test tím",
    players: "4",
    phone: "+421900000000",
    createdAt: new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" }),
  });
}
