import katex from "katex";

/** Escape plain text before splicing KaTeX HTML (XSS-safe). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function looksLikeMath(text: string): boolean {
  return typeof text === "string" && text.includes("$");
}

const KATEX_OPTS: katex.KatexOptions = {
  throwOnError: false,
  trust: false,
  strict: "ignore",
  output: "html",
};

function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { ...KATEX_OPTS, displayMode });
  } catch {
    return escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`);
  }
}

/**
 * Render mixed plain text + `$...$` / `$$...$$` to safe HTML.
 * Plain segments are escaped; math uses KaTeX (no raw HTML trust).
 * Answers stay stored as the author typed them — this is display-only.
 */
export function renderMathToHtml(source: string): string {
  const input = source ?? "";
  if (!input) return "";
  if (!input.includes("$")) {
    return escapeHtml(input).replace(/\n/g, "<br/>");
  }

  let out = "";
  let i = 0;
  const n = input.length;

  while (i < n) {
    if (input[i] === "$" && input[i + 1] === "$") {
      const end = input.indexOf("$$", i + 2);
      if (end !== -1) {
        out += renderTex(input.slice(i + 2, end), true);
        i = end + 2;
        continue;
      }
      out += escapeHtml("$$");
      i += 2;
      continue;
    }

    if (input[i] === "$") {
      let end = i + 1;
      while (end < n) {
        if (input[end] === "\\" && end + 1 < n) {
          end += 2;
          continue;
        }
        if (input[end] === "$") break;
        end += 1;
      }
      if (end < n && end > i + 1) {
        out += renderTex(input.slice(i + 1, end), false);
        i = end + 1;
        continue;
      }
      out += escapeHtml("$");
      i += 1;
      continue;
    }

    const next = input.indexOf("$", i);
    const chunk = next === -1 ? input.slice(i) : input.slice(i, next);
    out += escapeHtml(chunk).replace(/\n/g, "<br/>");
    i = next === -1 ? n : next;
  }

  return out;
}

/** Slovak hint for bank / quiz editors (plain text + example). */
export const MATH_EDITOR_HINT_SK =
  "Matematika: $\\frac{1}{2}$ (zlomok), $5,\\overline{3}$ (perióda). Obklop LaTeX dolármi.";
