"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const FIT_MARGIN = 0.98;

type Props = {
  enabled: boolean;
  slideKey: string;
  className?: string;
  children: ReactNode;
};

/** Rovnomerne zmenší obsah len ak presahuje rám (scale zostane 1, ak sa zmestí). */
export default function PresentationStageAutoFit({ enabled, slideKey, className = "", children }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!enabled) {
      setScale(1);
      return;
    }

    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    let raf = 0;

    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vh = viewport.clientHeight;
        const vw = viewport.clientWidth;
        if (vh < 1 || vw < 1) return;

        const ch = content.scrollHeight;
        const cw = content.scrollWidth;
        const scaleY = ch > vh ? (vh / ch) * FIT_MARGIN : 1;
        const scaleX = cw > vw ? (vw / cw) * FIT_MARGIN : 1;
        const next = Math.min(1, scaleX, scaleY);
        setScale((prev) => (Math.abs(prev - next) < 0.002 ? prev : next));
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(content);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [enabled, slideKey]);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={viewportRef} className={`${className} overflow-hidden`.trim()}>
      <div
        ref={contentRef}
        className="w-full flex flex-col items-center justify-center origin-center"
        style={{
          transform: scale < 0.999 ? `scale(${scale})` : undefined,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
