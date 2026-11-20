"use client";

import { useRef, useState, type ReactNode } from "react";
import { GripHorizontal, X } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * A movable dialog (Bubble-style property editor): drag it by its title bar.
 * It stays open while the page behind it is used, so edits show live.
 */
export function FloatingPanel({ title, subtitle, onClose, children, width = 360, initial, className }: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  initial?: { x: number; y: number };
  className?: string;
}) {
  const [pos, setPos] = useState(() => initial ?? { x: typeof window === "undefined" ? 200 : Math.max(16, window.innerWidth - width - 360), y: 90 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const x = Math.min(window.innerWidth - 80, Math.max(-width + 120, e.clientX - drag.current.dx));
    const y = Math.min(window.innerHeight - 48, Math.max(0, e.clientY - drag.current.dy));
    setPos({ x, y });
  }

  return (
    <div
      role="dialog"
      aria-label={typeof title === "string" ? title : undefined}
      className={cn("fixed z-[60] flex max-h-[80vh] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5", className)}
      style={{ left: pos.x, top: pos.y, width }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
    >
      <div
        className="flex cursor-move select-none items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <GripHorizontal className="h-4 w-4 shrink-0 text-zinc-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">{title}</p>
          {subtitle && <p className="truncate text-[11px] text-zinc-500">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-200" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}
