"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Copy, CornerLeftUp, GripVertical, Move, Trash2, Zap } from "lucide-react";
import { PARENT_TYPES, type Device, type LayoutNode, type ResponsiveStyle, type Style } from "@/lib/editor/schema";
import type { DropPosition } from "@/lib/editor/nodes";
import { effectiveStyle } from "@/lib/editor/nodes";
import { NodeSlotContext, type NodeBinding } from "@/components/storefront/nodes";
import { cn } from "@/components/ui";
import { elementLabel } from "./style-panel";

// Editor-only layer for custom-layout nodes: selection, drag to move between
// containers, drop indicators, resize handles, absolute positioning and
// Elementor-style padding/margin drag bands. Injected into the shared
// renderer through NodeEditProvider.useNode, so the storefront never loads it.

export type NodeTarget = { sectionId: string; nodeId: string };
export type DropHint = { nodeId: string; pos: DropPosition } | null;

export type CanvasNodeApi = {
  device: Device;
  /** CSS zoom applied to the canvas (pointer deltas are divided by it). */
  zoom: number;
  selected: NodeTarget | null;
  hint: DropHint;
  /** `additive`: shift-click adds/removes the element from a multi-selection. */
  select: (t: NodeTarget, parent?: boolean, additive?: boolean) => void;
  /** Other elements in the current multi-selection. */
  multi: string[];
  setStyle: <K extends keyof Style>(t: NodeTarget, key: K, value: Style[K] | undefined) => void;
  /** Several keys at once (one undo step), e.g. padding on all sides. */
  patchStyle: (t: NodeTarget, patch: Partial<Style>) => void;
  duplicate: (t: NodeTarget) => void;
  remove: (t: NodeTarget) => void;
  /** Opens the movable conditions & workflows dialog for an element. */
  openLogic: (t: NodeTarget) => void;
};

export const CanvasNodeContext = createContext<CanvasNodeApi | null>(null);
/** Per custom section: its id and the flow axis of its top level. */
export const SectionNodeContext = createContext<{ sectionId: string; axis: "x" | "y" } | null>(null);

const axisOf = (rs: ResponsiveStyle | undefined, device: Device, fallback: "x" | "y" = "y"): "x" | "y" => {
  const d = effectiveStyle(rs, device).direction;
  return d ? (d.startsWith("row") ? "x" : "y") : fallback;
};

/** Pointer drag helper with capture; reports deltas in canvas CSS px. */
function startDrag(e: React.PointerEvent, zoom: number, onMove: (dx: number, dy: number, ev: PointerEvent) => void, cursor: string, onEnd?: () => void) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  const sx = e.clientX, sy = e.clientY;
  document.body.style.cursor = cursor;
  const move = (ev: PointerEvent) => onMove((ev.clientX - sx) / zoom, (ev.clientY - sy) / zoom, ev);
  const end = () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", end);
    el.removeEventListener("pointercancel", end);
    document.body.style.cursor = "";
    onEnd?.();
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

const px = (v: string) => Math.round(parseFloat(v) || 0);
type Sides = { t: number; r: number; b: number; l: number };
const sidesOf = (cs: CSSStyleDeclaration, prop: "padding" | "margin"): Sides => ({
  t: px(cs.getPropertyValue(`${prop}-top`)), r: px(cs.getPropertyValue(`${prop}-right`)), b: px(cs.getPropertyValue(`${prop}-bottom`)), l: px(cs.getPropertyValue(`${prop}-left`)),
});

/** The hook every rendered node calls in the editor (see NodeEditApi.useNode). */
export function useNodeBinding(node: LayoutNode, parent: LayoutNode | null): NodeBinding {
  const api = useContext(CanvasNodeContext)!;
  const slot = useContext(NodeSlotContext);
  const section = useContext(SectionNodeContext);
  const sec = slot ?? section!;
  const target: NodeTarget = { sectionId: sec.sectionId, nodeId: node.id };
  const isContainer = PARENT_TYPES.has(node.type);
  const axis = parent ? axisOf(parent.style, api.device) : sec.axis;
  const eff = effectiveStyle(node.style, api.device);
  const absolute = eff.position === "absolute";
  const selected = api.selected?.nodeId === node.id;

  const drag = useDraggable({ id: `node:${node.id}`, data: { kind: "node", sectionId: sec.sectionId, nodeId: node.id, label: elementLabel(node.type) }, disabled: absolute });
  const drop = useDroppable({ id: `drop:${node.id}`, data: { kind: "node-target", sectionId: sec.sectionId, nodeId: node.id, isContainer, axis } });
  const el = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback((n: HTMLDivElement | null) => { el.current = n; drag.setNodeRef(n); drop.setNodeRef(n); }, [drag, drop]);

  // Absolute elements: drag the body to place them.
  const onPointerDown = absolute && selected ? (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest("[contenteditable], [data-chrome]") || !el.current) return;
    const cs = getComputedStyle(el.current);
    const left0 = px(cs.left), top0 = px(cs.top);
    let moved = false;
    startDrag(e, api.zoom, (dx, dy, ev) => {
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      const snap = ev.shiftKey ? 8 : 1;
      api.patchStyle(target, { left: { v: Math.round((left0 + dx) / snap) * snap, u: "px" }, top: { v: Math.round((top0 + dy) / snap) * snap, u: "px" }, right: undefined, bottom: undefined });
    }, "move");
  } : undefined;

  const showHint = api.hint?.nodeId === node.id ? api.hint.pos : null;

  return {
    ref: setRef,
    className: cn("ed-node", selected && "ed-selected", drag.isDragging && "opacity-40"),
    attrs: {
      onClick: (e) => { e.stopPropagation(); api.select(target, e.altKey, e.shiftKey); },
      onPointerDown,
      "data-node-id": node.id,
    },
    chrome: (
      <>
        {showHint && <DropIndicator pos={showHint} axis={axis} />}
        {api.multi.includes(node.id) && <div data-chrome className="pointer-events-none absolute inset-0 z-10 outline outline-2 -outline-offset-1 outline-brand-500 outline-dashed" />}
        {selected && (
          <NodeChrome
            node={node}
            elRef={el}
            target={target}
            absolute={absolute}
            hasParent={!!parent}
            dragHandle={absolute ? null : { ref: drag.setActivatorNodeRef, listeners: drag.listeners, attributes: drag.attributes }}
          />
        )}
      </>
    ),
  };
}

function DropIndicator({ pos, axis }: { pos: DropPosition; axis: "x" | "y" }) {
  if (pos === "inside") return <div data-chrome className="pointer-events-none absolute inset-0 z-30 rounded-sm border-2 border-dashed border-brand-500 bg-brand-500/10" />;
  const line = axis === "x"
    ? cn("top-0 bottom-0 w-1", pos === "before" ? "-left-0.5" : "-right-0.5")
    : cn("left-0 right-0 h-1", pos === "before" ? "-top-0.5" : "-bottom-0.5");
  return <div data-chrome className={cn("pointer-events-none absolute z-30 rounded-full bg-brand-500", line)} />;
}

type Handle = { ref: (el: HTMLElement | null) => void; listeners: ReturnType<typeof useDraggable>["listeners"]; attributes: ReturnType<typeof useDraggable>["attributes"] };

function NodeChrome({ node, elRef, target, absolute, hasParent, dragHandle }: {
  node: LayoutNode;
  elRef: React.RefObject<HTMLDivElement | null>;
  target: NodeTarget;
  absolute: boolean;
  hasParent: boolean;
  dragHandle: Handle | null;
}) {
  const api = useContext(CanvasNodeContext)!;
  const [box, setBox] = useState<{ pad: Sides; mar: Sides; w: number; h: number } | null>(null);
  const [readout, setReadout] = useState<string | null>(null);

  // Measure padding/margin after every render so the bands track edits (any
  // edit can move the edges); the equality check below stops it from looping.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const n = elRef.current;
    if (!n) return;
    const cs = getComputedStyle(n);
    const next = { pad: sidesOf(cs, "padding"), mar: sidesOf(cs, "margin"), w: n.offsetWidth, h: n.offsetHeight };
    setBox((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  function spacingDrag(e: React.PointerEvent, prop: "padding" | "margin", side: keyof Sides) {
    const n = elRef.current;
    if (!n) return;
    const start = sidesOf(getComputedStyle(n), prop);
    // Inward drags grow padding; outward drags grow margin.
    const sign: Record<keyof Sides, [number, number]> = prop === "padding"
      ? { t: [0, 1], b: [0, -1], l: [1, 0], r: [-1, 0] }
      : { t: [0, -1], b: [0, 1], l: [-1, 0], r: [1, 0] };
    const opposite: Record<keyof Sides, keyof Sides> = { t: "b", b: "t", l: "r", r: "l" };
    startDrag(e, api.zoom, (dx, dy, ev) => {
      const [sx, sy] = sign[side];
      const min = prop === "padding" ? 0 : -500;
      const v = Math.max(min, Math.min(2000, Math.round(start[side] + dx * sx + dy * sy)));
      const next = { ...start, [side]: v };
      if (ev.shiftKey) Object.assign(next, { t: v, r: v, b: v, l: v });
      else if (ev.altKey) next[opposite[side]] = v;
      api.setStyle(target, prop, { ...next, u: "px" });
      setReadout(`${prop} ${ev.shiftKey ? "all" : ev.altKey ? (side === "t" || side === "b" ? "top+bottom" : "left+right") : { t: "top", r: "right", b: "bottom", l: "left" }[side]}: ${v}px`);
    }, side === "t" || side === "b" ? "ns-resize" : "ew-resize", () => setReadout(null));
  }

  function sizeDrag(e: React.PointerEvent, dim: "w" | "h") {
    const n = elRef.current;
    const parentEl = n?.parentElement;
    if (!n || !parentEl) return;
    const w0 = n.offsetWidth, h0 = n.offsetHeight, pw = parentEl.clientWidth || 1;
    startDrag(e, api.zoom, (dx, dy, ev) => {
      if (dim === "w") {
        if (ev.shiftKey) {
          const w = Math.max(20, Math.round(w0 + dx));
          api.setStyle(target, "width", { v: w, u: "px" });
          setReadout(`width ${w}px`);
        } else {
          const pct = Math.max(5, Math.min(100, Math.round(((w0 + dx) / pw) * 100)));
          api.setStyle(target, "width", { v: pct, u: "%" });
          setReadout(`width ${pct}% (Shift: px)`);
        }
      } else {
        const h = Math.max(8, Math.round((h0 + dy) / (ev.shiftKey ? 1 : 4)) * (ev.shiftKey ? 1 : 4));
        const key = PARENT_TYPES.has(node.type) ? "minHeight" : "height";
        api.setStyle(target, key, { v: h, u: "px" });
        setReadout(`${key === "minHeight" ? "min height" : "height"} ${h}px`);
      }
    }, dim === "w" ? "ew-resize" : "ns-resize", () => setReadout(null));
  }

  const band = "absolute z-20 touch-none";
  const padTint = "bg-emerald-400/25 hover:bg-emerald-400/45";
  const marTint = "bg-orange-400/25 hover:bg-orange-400/45";
  const pad = box?.pad ?? { t: 0, r: 0, b: 0, l: 0 };
  const mar = box?.mar ?? { t: 0, r: 0, b: 0, l: 0 };
  const thick = (v: number) => Math.max(6, v);

  return (
    // display:contents — the chrome must never become a flex item of the node.
    <div data-chrome className="contents" onClick={stop} onDoubleClick={stop}>
      <div className="pointer-events-none absolute inset-0 z-10 outline outline-2 -outline-offset-1 outline-brand-600" />
      {/* Padding bands (inside) */}
      <div className={cn(band, padTint, "left-0 right-0 top-0 cursor-ns-resize")} style={{ height: thick(pad.t) }} onPointerDown={(e) => spacingDrag(e, "padding", "t")} title="Padding top — drag (Alt: top+bottom, Shift: all sides)" />
      <div className={cn(band, padTint, "bottom-0 left-0 right-0 cursor-ns-resize")} style={{ height: thick(pad.b) }} onPointerDown={(e) => spacingDrag(e, "padding", "b")} title="Padding bottom" />
      <div className={cn(band, padTint, "bottom-0 left-0 top-0 cursor-ew-resize")} style={{ width: thick(pad.l) }} onPointerDown={(e) => spacingDrag(e, "padding", "l")} title="Padding left" />
      <div className={cn(band, padTint, "bottom-0 right-0 top-0 cursor-ew-resize")} style={{ width: thick(pad.r) }} onPointerDown={(e) => spacingDrag(e, "padding", "r")} title="Padding right" />
      {/* Margin bands (outside) */}
      <div className={cn(band, marTint, "left-0 right-0 cursor-ns-resize")} style={{ height: thick(Math.max(0, mar.t)), top: -thick(Math.max(0, mar.t)) }} onPointerDown={(e) => spacingDrag(e, "margin", "t")} title="Margin top — drag up to grow" />
      <div className={cn(band, marTint, "left-0 right-0 cursor-ns-resize")} style={{ height: thick(Math.max(0, mar.b)), bottom: -thick(Math.max(0, mar.b)) }} onPointerDown={(e) => spacingDrag(e, "margin", "b")} title="Margin bottom — drag down to grow" />
      {/* Size handles */}
      <div className="absolute -right-1.5 top-1/2 z-30 flex h-10 w-3 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center" onPointerDown={(e) => sizeDrag(e, "w")} title="Drag to set width (% of parent, Shift for px)">
        <span className="h-8 w-1.5 rounded-full bg-brand-600 ring-2 ring-white" />
      </div>
      <div className="absolute -bottom-1.5 left-1/2 z-30 flex h-3 w-10 -translate-x-1/2 cursor-ns-resize touch-none items-center justify-center" onPointerDown={(e) => sizeDrag(e, "h")} title="Drag to set height">
        <span className="h-1.5 w-8 rounded-full bg-brand-600 ring-2 ring-white" />
      </div>
      {/* Toolbar */}
      <div className="absolute -top-6 left-0 z-40 flex h-6 items-center gap-0.5 rounded-t-md bg-brand-600 px-1 text-white shadow">
        {dragHandle ? (
          <button ref={dragHandle.ref} {...dragHandle.listeners} {...dragHandle.attributes} className="cursor-grab rounded p-0.5 hover:bg-white/20 active:cursor-grabbing" aria-label="Drag to move"><GripVertical className="h-3.5 w-3.5" /></button>
        ) : (
          <span className="p-0.5" title="Drag the element to move it"><Move className="h-3.5 w-3.5" /></span>
        )}
        <span className="px-1 text-[11px] font-semibold">{elementLabel(node.type)}{absolute ? " · absolute" : ""}</span>
        {hasParent && <button onClick={() => api.select(target, true)} className="rounded p-0.5 hover:bg-white/20" title="Select parent (Alt+click)"><CornerLeftUp className="h-3.5 w-3.5" /></button>}
        <button onClick={() => api.openLogic(target)} className="rounded p-0.5 hover:bg-white/20" title="Conditions & workflows"><Zap className={cn("h-3.5 w-3.5", (node.conditions?.length ?? 0) > 0 && "fill-current")} /></button>
        <button onClick={() => api.duplicate(target)} className="rounded p-0.5 hover:bg-white/20" title="Duplicate (⌘D)"><Copy className="h-3.5 w-3.5" /></button>
        <button onClick={() => api.remove(target)} className="rounded p-0.5 hover:bg-white/20" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {readout && <span className="pointer-events-none absolute -bottom-7 right-0 z-40 whitespace-nowrap rounded bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-white shadow">{readout}</span>}
    </div>
  );
}
