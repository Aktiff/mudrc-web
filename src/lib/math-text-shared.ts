/** Escape plain text before splicing KaTeX HTML (XSS-safe). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Coerce unknown values so a bad bank row cannot crash the UI. */
export function coerceMathSource(source: unknown): string {
  if (typeof source === "string") return source;
  if (source == null) return "";
  try {
    return String(source);
  } catch {
    return "";
  }
}

export function looksLikeMath(text: unknown): boolean {
  return coerceMathSource(text).includes("$");
}

/** Slovak hint for bank / quiz editors (plain text + example). */
export const MATH_EDITOR_HINT_SK =
  "Matematika: $\\frac{1}{2}$ (zlomok), $5,\\overline{3}$ (perióda). Obklop LaTeX dolármi.";
