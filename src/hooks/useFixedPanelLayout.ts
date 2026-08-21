"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type FixedLayout = {
  left: number;
  width: number;
};

export function useFixedPanelLayout(enabled: boolean): {
  slotRef: RefObject<HTMLDivElement>;
  layout: FixedLayout | null;
} {
  const slotRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<FixedLayout | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLayout(null);
      return;
    }

    const measure = () => {
      if (window.innerWidth < 1024) {
        setLayout(null);
        return;
      }
      const slot = slotRef.current;
      if (!slot) return;
      const rect = slot.getBoundingClientRect();
      if (rect.width < 1) return;
      setLayout({ left: rect.left, width: rect.width });
    };

    measure();
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    const slot = slotRef.current;
    if (slot) observer.observe(slot);

    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [enabled]);

  return { slotRef, layout };
}
