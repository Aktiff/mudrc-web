import type { CSSProperties } from "react";
import { looksLikeMath, renderMathToHtml } from "@/lib/math-text";

type Props = {
  text: string;
  className?: string;
  style?: CSSProperties;
  /** Wrapper element; default span. Use div for block layout. */
  as?: "span" | "p" | "div";
};

/** Safe display of plain text mixed with `$...$` / `$$...$$` math. */
export default function MathText({ text, className, style, as: Tag = "span" }: Props) {
  const html = renderMathToHtml(text ?? "");
  return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MathLivePreview({ value, className }: { value: string; className?: string }) {
  if (!looksLikeMath(value)) return null;
  return (
    <div
      className={
        className ??
        "mt-1.5 rounded-lg border border-brand-border bg-brand-surface/80 px-3 py-2 text-sm text-brand-text"
      }
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted mb-1">Náhľad</p>
      <MathText text={value} className="leading-snug break-words" />
    </div>
  );
}
