"use client";

import { useRef, useState } from "react";

interface CompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

/** Comparador deslizante: superpone dos imágenes con un divisor arrastrable. */
export default function CompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Original",
  afterLabel = "Ampliada",
}: CompareSliderProps) {
  const [pos, setPos] = useState(50); // % del divisor
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) updateFromClientX(e.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden rounded-xl bg-[hsl(var(--surface))]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* After (debajo, ocupa todo) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt={afterLabel} className="block max-h-[70vh] w-full object-contain" draggable={false} />
      {/* Before (encima, recortado por clip) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt={beforeLabel} className="block max-h-[70vh] w-full object-contain" draggable={false} />
      </div>
      {/* Etiquetas */}
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
        {afterLabel}
      </span>
      {/* Divisor */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-1.5 py-0.5 text-[10px] text-black">
          ↔
        </div>
      </div>
    </div>
  );
}
