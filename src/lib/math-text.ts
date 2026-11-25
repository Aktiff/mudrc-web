import katex from "katex";
import { coerceMathSource, escapeHtml } from "@/lib/math-text-shared";

export { coerceMathSource, escapeHtml, looksLikeMath, MATH_EDITOR_HINT_SK } from "@/lib/math-text-shared";

/** Skip absurdly long `$...$` spans (e.g. two currency `$` far apart). */
const MAX_MATH_SPAN = 400;

const KATEX_OPTS: katex.KatexOptions = {
  throwOnError: false,
  trust: false,
  strict: "ignore",
  output: "html",
};

function renderTex(tex: string, displayMode: boolean): string {
  if (tex.length > MAX_MATH_SPAN) {
    return escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`);
  }
  try {
    return katex.renderToString(tex, { ...KATEX_OPTS, displayMode });
  } catch {
    return escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`);
  }
}

function renderMathToHtmlUnsafe(input: string): string {
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

/**
 * Render mixed plain text + `$...$` / `$$...$$` to safe HTML.
 * Plain segments are escaped; math uses KaTeX (no raw HTML trust).
 * Answers stay stored as the author typed them — this is display-only.
 * Never throws — bad input falls back to escaped plain text.
 */
export function renderMathToHtml(source: unknown): string {
  const input = coerceMathSource(source);
  try {
    return renderMathToHtmlUnsafe(input);
  } catch {
    return escapeHtml(input).replace(/\n/g, "<br/>");
  }
}
