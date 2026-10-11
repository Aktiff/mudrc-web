import { formatSkWeekday, type QuizEvent } from "@/lib/data";
import { isGeneralQuizType, quizTypeOrDefault } from "@/lib/quiz-type";
import { eventPath } from "@/lib/regions";
import { absoluteUrl } from "@/lib/site-url";

/** Verejné číslo z webu (tel:+421951457439), vo formáte z príspevkov na stránke. */
export const MUDRC_PUBLIC_PHONE = "0951 457 439";

const SK_MONTHS_GENITIVE = [
  "januára",
  "februára",
  "marca",
  "apríla",
  "mája",
  "júna",
  "júla",
  "augusta",
  "septembra",
  "októbra",
  "novembra",
  "decembra",
];

function quizKindPhrase(quizType: string | undefined): string {
  const label = quizTypeOrDefault(quizType);
  if (isGeneralQuizType(label)) return "vedomostný kvíz";
  return label.toLocaleLowerCase("sk");
}

function formatWhen(date: string, time: string): string {
  const weekday = formatSkWeekday(date);
  const match = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const clock = time.trim() ? ` o ${time.trim()}` : "";
  if (!match) {
    const base = [weekday, date.trim()].filter(Boolean).join(", ");
    return `${base}${clock}`;
  }
  const day = Number(match[1]);
  const month = SK_MONTHS_GENITIVE[Number(match[2]) - 1];
  const dayPart = month ? `${day}. ${month}` : date.trim();
  return weekday ? `${weekday}, ${dayPart}${clock}` : `${dayPart}${clock}`;
}

function formatFee(entryFee: number): string {
  if (!Number.isFinite(entryFee) || entryFee <= 0) return "zadarmo";
  const amount = Number.isInteger(entryFee) ? String(entryFee) : String(entryFee).replace(".", ",");
  return `${amount} € na hráča`;
}

function formatTeamSize(minPlayers: number, maxPlayers: number): string {
  const min = Number.isFinite(minPlayers) ? minPlayers : 0;
  const max = Number.isFinite(maxPlayers) ? maxPlayers : 0;
  if (min > 0 && max > 0 && min !== max) return `${min} až ${max} v tíme`;
  const only = max || min;
  return only > 0 ? `${only} v tíme` : "podľa kapacity podniku";
}

function formatWhere(event: Pick<QuizEvent, "venue" | "city" | "address">): string {
  const place = [event.venue.trim(), event.city.trim()].filter(Boolean).join(", ");
  const address = event.address.trim();
  if (place && address) return `${place} — ${address}`;
  return place || address;
}

/** Text príspevku na Facebook stránku z uložených údajov udalosti. */
export function buildFacebookEventPost(event: QuizEvent): string {
  const venue = event.venue.trim();
  const city = event.city.trim();
  const titlePlace = [venue, city].filter(Boolean).join(", ");
  const kind = quizKindPhrase(event.quizType);
  const registrationUrl = absoluteUrl(eventPath(event));

  return [
    `🧠 KVÍZOVÝ VEČER MUDRC | ${titlePlace}`,
    "",
    `Máte radi výzvy, dobrú partiu a atmosféru, kde sa vám z hlavy parí? Príďte si zmerať sily na ďalší ${kind} pod značkou MUDRC! Čakajú vás zaujímavé otázky, skvelá nálada a súboj o titul najväčších mudrcov večera.`,
    "",
    `📌 Kedy: ${formatWhen(event.date, event.time)}`,
    `📍 Kde: ${formatWhere(event)}`,
    `💰 Vstupné: ${formatFee(event.entryFee)}`,
    `👥 Počet hráčov: ${formatTeamSize(event.minPlayers, event.maxPlayers)}`,
    "",
    "📋 Registrácia:",
    `Nenechávajte si to na poslednú chvíľu, kapacita stolov je obmedzená. Na kvíz sa treba vopred zaregistrovať na ${registrationUrl} alebo na ${MUDRC_PUBLIC_PHONE}.`,
    "",
    "Dajte dokopy partiu a príďte ukázať, čo je vo vás! 🍻",
  ].join("\n");
}
