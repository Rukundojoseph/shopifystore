"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Renders children at a fixed virtual width, scaled to fit the available width. */
export function ScaledFrame({ width, height, children, className }: { width: number; height: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={className} style={{ height, overflow: "hidden", position: "relative" }}>
      {scale > 0 && (
        <div className="pointer-events-none select-none" style={{ width, height: height / scale, transform: `scale(${scale})`, transformOrigin: "top left" }} aria-hidden>
          {children}
        </div>
      )}
    </div>
  );
}
