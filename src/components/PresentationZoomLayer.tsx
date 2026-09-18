"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

type Props = {
  slideKey: string;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
  onBackgroundClick?: (e: MouseEvent<HTMLDivElement>) => void;
};

export default function PresentationZoomLayer({
  slideKey,
  className = "",
  innerClassName = "",
  children,
  onBackgroundClick,
}: Props) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const transformRef = useRef(transform);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const blockClickRef = useRef(false);

  useEffect(() => {
    scaleRef.current = transform.scale;
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
    dragRef.current = null;
    blockClickRef.current = false;
  }, [slideKey]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTransform((prev) => {
        const factor = Math.exp(-e.deltaY * 0.0011);
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        if (nextScale <= MIN_SCALE + 0.001) {
          return { scale: 1, x: 0, y: 0 };
        }
        return { ...prev, scale: nextScale };
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [slideKey]);

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || scaleRef.current <= 1) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
    setTransform((prev) => ({
      ...prev,
      x: drag.originX + dx,
      y: drag.originY + dy,
    }));
  }, []);

  const endDrag = useCallback(() => {
    if (dragRef.current?.moved) blockClickRef.current = true;
    dragRef.current = null;
  }, []);

  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (blockClickRef.current) {
        blockClickRef.current = false;
        return;
      }
      if (scaleRef.current > 1) return;
      onBackgroundClick?.(e);
    },
    [onBackgroundClick]
  );

  const innerStyle: CSSProperties = {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
    transformOrigin: "center center",
  };

  const isZoomed = transform.scale > 1;

  return (
    <div
      ref={viewportRef}
      className={`overflow-hidden touch-none box-border ${isZoomed ? "cursor-grab active:cursor-grabbing" : ""} ${className}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="presentation"
    >
      <div
        className={`w-full h-full min-h-0 max-h-full flex items-center justify-center will-change-transform ${innerClassName}`}
        style={innerStyle}
      >
        {children}
      </div>
    </div>
  );
}
