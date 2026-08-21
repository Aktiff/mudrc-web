const NBSP = "\u00A0";

/** Za týmito slovami musí nasledovať pevná medzera — nesmú ostať samé na konci riadka. */
const BIND_TO_NEXT = [
  "a",
  "i",
  "o",
  "u",
  "v",
  "z",
  "k",
  "s",
  "aj",
  "na",
  "do",
  "od",
  "po",
  "za",
  "ku",
  "zo",
  "so",
  "vo",
  "ke",
  "ne",
  "ni",
  "ta",
  "ti",
  "to",
  "ty",
  "ve",
  "vi",
  "by",
  "či",
  "co",
  "čo",
  "no",
  "pri",
  "pre",
  "nad",
  "pod",
  "bez",
  "cez",
  "kde",
  "kam",
  "ako",
  "ak",
  "ale",
  "ani",
  "aby",
  "kým",
  "keď",
  "lebo",
  "preto",
  "potom",
  "tam",
  "tu",
  "tým",
  "tú",
  "tá",
  "tie",
  "tí",
  "ten",
  "táto",
  "toto",
  "tento",
  "tieto",
  "je",
  "sú",
  "som",
  "ste",
  "sme",
  "ho",
  "ju",
  "im",
  "ich",
  "mu",
  "mi",
  "nás",
  "vás",
];

/** Pred týmito slovami musí byť pevná medzera — nesmú ostať samé na začiatku riadka. */
const BIND_TO_PREV = ["sa", "si", "se"];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BIND_NEXT_RE = new RegExp(`\\b(${BIND_TO_NEXT.map(escapeRegex).join("|")})\\s+`, "giu");
const BIND_PREV_RE = new RegExp(`(\\S+)\\s+(\\b(?:${BIND_TO_PREV.map(escapeRegex).join("|")})\\b)`, "giu");

/**
 * Vloží pevné medzery podľa slovenských typografických pravidiel,
 * aby krátke spojky a častice neviseli samé na konci riadka.
 */
export function fixSlovakLineBreaks(text: string): string {
  if (!text.trim()) return text;

  return text
    .replace(BIND_PREV_RE, (_, prev: string, word: string) => `${prev}${NBSP}${word}`)
    .replace(BIND_NEXT_RE, (_, word: string) => `${word}${NBSP}`);
}
