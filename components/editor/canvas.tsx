"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Bookmark, Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import type { Device, Section, SettingValue, SiteConfig, SitePage } from "@/lib/editor/schema";
import { effectiveStyle } from "@/lib/editor/nodes";
import { NodeEditProvider, type NodeEditApi } from "@/components/storefront/nodes";
import { CanvasNodeContext, SectionNodeContext, useNodeBinding, type CanvasNodeApi } from "./node-chrome";
import { SECTION_MAP, num } from "@/lib/editor/sections";
import { RenderSection, sectionBox } from "@/components/storefront/sections";
import { InlineEditProvider } from "@/components/storefront/inline-edit";
import { themeVars } from "@/components/storefront/theme";
import type { StorefrontCtx } from "@/components/storefront/types";
import { cn } from "@/components/ui";

export type Selection =
  | { kind: "section"; id: string }
  | { kind: "node"; sectionId: string; nodeId: string }
  | { kind: "header" }
  | { kind: "footer" }
  | { kind: "theme" }
  | { kind: "page" };

/** Virtual canvas widths; the canvas is zoomed down to fit when space is short. */
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };

type SectionActions = {
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  /** Inline text edits and drag-resizes. `target` is a section id, "header" or "footer". */
  onSetting: (target: string, key: string, value: SettingValue) => void;
  /** Text edits made directly on a custom-layout element. */
  onNodeProp: (sectionId: string, nodeId: string, key: string, value: string | number | boolean) => void;
  onSaveBlock: (id: string) => void;
};

function Toolbar({ label, children, dragHandle }: { label: string; children?: React.ReactNode; dragHandle?: React.ReactNode }) {
  return (
    <div className="absolute -top-px left-0 z-20 flex items-center gap-0.5 rounded-br-md bg-brand-600 px-1 py-0.5 text-white shadow" onClick={(e) => e.stopPropagation()}>
      {dragHandle}
      <span className="px-1 text-[11px] font-semibold">{label}</span>
      {children}
    </div>
  );
}

const TB = "rounded p-1 hover:bg-white/20";

function SortableSection({ section, ctx, selected, index, count, actions, device }: { section: Section; ctx: StorefrontCtx; selected: boolean; index: number; count: number; actions: SectionActions; device: Device }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const boxRef = useRef<HTMLDivElement | null>(null);
  const def = SECTION_MAP[section.type];
  const box = sectionBox(section);
  const onChange = (key: string, value: SettingValue) => actions.onSetting(section.id, key, value);
  return (
    <div
      data-section-id={section.id}
      ref={(el) => { setNodeRef(el); boxRef.current = el; }}
      style={{ ...box?.style, transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative", box?.className, isDragging && "z-30 opacity-60")}
      onClick={(e) => { e.stopPropagation(); actions.onSelect(section.id); }}
    >
      <div className={cn("pointer-events-none absolute inset-0 z-10 transition", selected ? "ring-2 ring-inset ring-brand-600" : "group-hover:ring-2 group-hover:ring-inset group-hover:ring-brand-500/50")} />
      {(selected || isDragging) && (
        <Toolbar
          label={def?.label ?? section.type}
          dragHandle={<button ref={setActivatorNodeRef} {...listeners} {...attributes} className={cn(TB, "cursor-grab active:cursor-grabbing")} aria-label="Drag to reorder"><GripVertical className="h-3.5 w-3.5" /></button>}
        >
          <button className={TB} disabled={index === 0} onClick={() => actions.onMove(section.id, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button className={TB} disabled={index === count - 1} onClick={() => actions.onMove(section.id, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
          <button className={TB} onClick={() => actions.onDuplicate(section.id)} aria-label="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
          <button className={TB} onClick={() => actions.onSaveBlock(section.id)} aria-label="Save as reusable block" title="Save as reusable block"><Bookmark className="h-3.5 w-3.5" /></button>
          {!def?.system && <button className={TB} onClick={() => actions.onToggle(section.id)} aria-label={section.hidden ? "Show" : "Hide"}>{section.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>}
          {!def?.system && <button className={TB} onClick={() => actions.onDelete(section.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}
        </Toolbar>
      )}
      {!selected && !isDragging && (
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="absolute left-1 top-1 z-20 hidden cursor-grab rounded bg-brand-600 p-1 text-white shadow group-hover:block"
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      {section.hidden ? (
        <div className="flex items-center justify-center gap-2 border-y border-dashed border-zinc-300 bg-zinc-50 py-4 text-xs text-zinc-500"><EyeOff className="h-3.5 w-3.5" /> {def?.label} (hidden)</div>
      ) : (
        <InlineEditProvider value={{ settings: section.settings, onChange }}>
          {section.type === "custom" ? (
            <CustomSectionEditing section={section} device={device} onNodeProp={actions.onNodeProp}>
              <RenderSection section={section} ctx={ctx} bare />
            </CustomSectionEditing>
          ) : (
            <RenderSection section={section} ctx={ctx} bare />
          )}
        </InlineEditProvider>
      )}
      {selected && !section.hidden && !isDragging && <ResizeHandles section={section} boxRef={boxRef} onChange={onChange} widthEnabled={device !== "mobile"} />}
    </div>
  );
}

/** Hooks a custom section's element tree up to the editor (selection, dnd, handles). */
function CustomSectionEditing({ section, sectionId = section.id, device, onNodeProp, children }: { section: Section; sectionId?: string; device: Device; onNodeProp: SectionActions["onNodeProp"]; children: React.ReactNode }) {
  const dir = effectiveStyle(section.style, device).direction;
  const sec = useMemo(() => ({ sectionId, axis: (dir?.startsWith("row") ? "x" : "y") as "x" | "y" }), [sectionId, dir]);
  const edit: NodeEditApi = useMemo(() => ({ useNode: useNodeBinding, setProp: (nodeId, k, v, slot) => onNodeProp(slot ?? sectionId, nodeId, k, v) }), [sectionId, onNodeProp]);
  return (
    <SectionNodeContext.Provider value={sec}>
      <NodeEditProvider value={edit}>{children}</NodeEditProvider>
    </SectionNodeContext.Provider>
  );
}

function GlobalSection({ section, target, ctx, selected, onSelect, label, onSetting, device, onNodeProp }: {
  section: Section; target: "header" | "footer"; ctx: StorefrontCtx; selected: boolean; onSelect: () => void; label: string;
  onSetting: (key: string, value: SettingValue) => void; device: Device; onNodeProp: SectionActions["onNodeProp"];
}) {
  return (
    <div className="group relative" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <div className={cn("pointer-events-none absolute inset-0 z-10", selected ? "ring-2 ring-inset ring-brand-600" : "group-hover:ring-2 group-hover:ring-inset group-hover:ring-brand-500/50")} />
      {selected && <Toolbar label={`${label} · all pages`} />}
      <InlineEditProvider value={{ settings: section.settings, onChange: onSetting }}>
        {/* The header's custom information bar holds elements, editable like a page section. */}
        <CustomSectionEditing section={section} sectionId={target} device={device} onNodeProp={onNodeProp}>
          <RenderSection section={section} ctx={ctx} />
        </CustomSectionEditing>
      </InlineEditProvider>
    </div>
  );
}

type Edge = "bottom" | "left" | "right";

/**
 * Drag the bottom edge to set the section's height, or a side edge to set its
 * width (centred, symmetric). Double-click a handle to reset that dimension.
 * Each drag coalesces into one undo step (history key is per section+setting).
 */
function ResizeHandles({ section, boxRef, onChange, widthEnabled }: { section: Section; boxRef: React.RefObject<HTMLDivElement | null>; onChange: (key: string, value: SettingValue) => void; widthEnabled: boolean }) {
  const [readout, setReadout] = useState<string | null>(null);

  function start(e: React.PointerEvent<HTMLDivElement>, edge: Edge) {
    const box = boxRef.current;
    const page = box?.parentElement;
    if (!box || !page || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const rect = box.getBoundingClientRect();
    const pageWidth = page.getBoundingClientRect().width;
    const zoom = rect.width / (box.offsetWidth || rect.width || 1) || 1;
    const sx = e.clientX, sy = e.clientY;
    document.body.style.cursor = edge === "bottom" ? "ns-resize" : "ew-resize";

    const move = (ev: PointerEvent) => {
      if (edge === "bottom") {
        const step = ev.shiftKey ? 1 : 8;
        const h = Math.max(24, Math.min(2000, Math.round((rect.height + ev.clientY - sy) / zoom / step) * step));
        onChange("minHeight", h);
        setReadout(`${h} px`);
      } else {
        const dx = (ev.clientX - sx) * (edge === "right" ? 1 : -1);
        const w = Math.max(30, Math.min(100, Math.round(((rect.width + 2 * dx) / pageWidth) * 100)));
        onChange("width", w >= 100 ? null : w);
        setReadout(`${w}% width`);
      }
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      document.body.style.cursor = "";
      setReadout(null);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  const h = num(section, "minHeight", 0);
  const w = num(section, "width", 100);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const bar = "absolute z-20 flex items-center justify-center touch-none";
  const grip = "rounded-full bg-brand-600 shadow ring-2 ring-white transition group-hover/h:scale-110";

  return (
    <>
      <div
        className={cn(bar, "group/h -bottom-1.5 left-0 right-0 h-3 cursor-ns-resize")}
        onPointerDown={(e) => start(e, "bottom")}
        onClick={stop}
        onDoubleClick={(e) => { stop(e); onChange("minHeight", null); }}
        title={h ? `Height ${h}px — drag to resize, double-click to reset` : "Drag to set height"}
      >
        <span className={cn(grip, "h-1.5 w-12")} />
      </div>
      {widthEnabled && (["left", "right"] as const).map((edge) => (
        <div
          key={edge}
          className={cn(bar, "group/h top-0 bottom-0 w-3 cursor-ew-resize", edge === "left" ? "-left-1.5" : "-right-1.5")}
          onPointerDown={(e) => start(e, edge)}
          onClick={stop}
          onDoubleClick={(e) => { stop(e); onChange("width", null); }}
          title={w < 100 ? `Width ${w}% — drag to resize, double-click to reset` : "Drag to set width"}
        >
          <span className={cn(grip, "h-12 w-1.5")} />
        </div>
      ))}
      {readout && <span className="pointer-events-none absolute bottom-3 right-3 z-30 rounded bg-zinc-900 px-2 py-1 font-mono text-[11px] text-white shadow">{readout}</span>}
    </>
  );
}

function DropZone({ empty }: { empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-end" });
  return (
    <div ref={setNodeRef} className={cn("m-4 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm transition", empty ? "py-24" : "py-8", isOver ? "border-brand-500 bg-brand-50 text-brand-700" : "border-zinc-300 text-zinc-400")}>
      <Plus className="h-4 w-4" /> {empty ? "Drag sections here from the left panel" : "Drop a section here"}
    </div>
  );
}

export function Canvas({
  config, page, ctx, device, selection, setSelection, actions, nodeApi, previewId,
}: {
  config: SiteConfig;
  page: SitePage;
  /** A condition being previewed from the logic dialog. */
  previewId?: string | null;
  ctx: StorefrontCtx;
  device: Device;
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  actions: SectionActions;
  nodeApi: Omit<CanvasNodeApi, "zoom" | "device">;
}) {
  const sel = selection?.kind === "section" ? selection.id : null;

  // Render at the device's real width so container queries (and so the
  // responsive styles) match what visitors see; zoom out to fit the panel.
  const fitRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const frame = device === "desktop" ? 0 : 16; // device bezel
  const width = DEVICE_WIDTH[device];
  const zoom = avail ? Math.max(0.4, Math.min(1, avail / (width + frame))) : 1;
  const nodeCtx = useMemo<CanvasNodeApi>(() => ({ ...nodeApi, device, zoom }), [nodeApi, device, zoom]);

  return (
    <div ref={fitRef} className="w-full">
    <CanvasNodeContext.Provider value={nodeCtx}>
    <div
      data-zoom={zoom}
      style={{ width: width + frame, zoom }}
      className={cn("mx-auto bg-white shadow-lg", device === "mobile" ? "overflow-hidden rounded-[28px] border-8 border-zinc-900" : device === "tablet" ? "overflow-hidden rounded-[20px] border-8 border-zinc-800" : "")}
      onClickCapture={(e) => {
        // Links are inert inside the editor.
        if ((e.target as HTMLElement).closest("a")) e.preventDefault();
      }}
      onClick={() => setSelection(null)}
    >
      <div style={themeVars(config.theme)} className="sf-tw @container min-h-[70vh]" data-sf-preview={previewId ?? undefined}>
        <GlobalSection section={config.header} ctx={ctx} selected={selection?.kind === "header"} onSelect={() => setSelection({ kind: "header" })} label="Navigation bar" target="header" device={device} onNodeProp={actions.onNodeProp} onSetting={(k, v) => actions.onSetting("header", k, v)} />
        <SortableContext items={page.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {page.sections.map((s, i) => (
            <SortableSection key={s.id} section={s} ctx={ctx} selected={sel === s.id} index={i} count={page.sections.length} actions={actions} device={device} />
          ))}
        </SortableContext>
        <DropZone empty={page.sections.length === 0} />
        <GlobalSection section={config.footer} ctx={ctx} selected={selection?.kind === "footer"} onSelect={() => setSelection({ kind: "footer" })} label="Footer" target="footer" device={device} onNodeProp={actions.onNodeProp} onSetting={(k, v) => actions.onSetting("footer", k, v)} />
      </div>
    </div>
    </CanvasNodeContext.Provider>
    </div>
  );
}
