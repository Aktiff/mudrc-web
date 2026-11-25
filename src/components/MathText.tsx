"use client";

import { Component, useEffect, useState, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { coerceMathSource, escapeHtml, looksLikeMath } from "@/lib/math-text-shared";

type Props = {
  text: unknown;
  className?: string;
  style?: CSSProperties;
  /** Wrapper element; default span. Use div for block layout. */
  as?: "span" | "p" | "div";
};

function plainHtml(text: unknown): string {
  return escapeHtml(coerceMathSource(text)).replace(/\n/g, "<br/>");
}

/**
 * Safe display of plain text mixed with `$...$` / `$$...$$` math.
 * KaTeX is loaded asynchronously so a chunk/load failure cannot blank the bank UI —
 * authors still see escaped plain text and can save.
 */
export default function MathText({ text, className, style, as: Tag = "span" }: Props) {
  const raw = coerceMathSource(text);
  const [html, setHtml] = useState(() => plainHtml(raw));

  useEffect(() => {
    let alive = true;
    const source = coerceMathSource(text);

    if (!looksLikeMath(source)) {
      setHtml(plainHtml(source));
      return () => {
        alive = false;
      };
    }

    // Start with plain text, then upgrade — keeps the editor usable if KaTeX fails.
    setHtml(plainHtml(source));

    void import("@/lib/math-text")
      .then(({ renderMathToHtml }) => {
        if (!alive) return;
        setHtml(renderMathToHtml(source));
      })
      .catch(() => {
        if (!alive) return;
        setHtml(plainHtml(source));
      });

    return () => {
      alive = false;
    };
  }, [text]);

  return (
    <MathRenderBoundary fallbackText={raw} className={className} style={style} as={Tag}>
      <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />
    </MathRenderBoundary>
  );
}

type BoundaryProps = {
  children: ReactNode;
  fallbackText: string;
  className?: string;
  style?: CSSProperties;
  as: "span" | "p" | "div";
};

type BoundaryState = { failed: boolean };

/** Isolates a KaTeX/DOM crash so the rest of the bank page keeps working. */
class MathRenderBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    /* swallow — preview must not take down the bank editor */
  }

  componentDidUpdate(prevProps: BoundaryProps): void {
    if (prevProps.fallbackText !== this.props.fallbackText && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    if (this.state.failed) {
      const Tag = this.props.as;
      return (
        <Tag className={this.props.className} style={this.props.style}>
          {this.props.fallbackText}
        </Tag>
      );
    }
    return this.props.children;
  }
}

export function MathLivePreview({ value, className }: { value: string; className?: string }) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), 120);
    return () => window.clearTimeout(timer);
  }, [value]);

  if (!looksLikeMath(debounced)) return null;

  return (
    <div
      className={
        className ??
        "mt-1.5 rounded-lg border border-brand-border bg-brand-surface/80 px-3 py-2 text-sm text-brand-text"
      }
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted mb-1">Náhľad</p>
      <MathText text={debounced} className="leading-snug break-words" />
    </div>
  );
}
