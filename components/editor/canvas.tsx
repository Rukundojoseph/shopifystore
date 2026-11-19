"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import type { Section, SiteConfig } from "@/lib/editor/schema";
import { SECTION_MAP } from "@/lib/editor/sections";
import { RenderSection } from "@/components/storefront/sections";
import { themeVars } from "@/components/storefront/theme";
import type { StorefrontCtx } from "@/components/storefront/types";
import { cn } from "@/components/ui";

export type Selection = { kind: "section"; id: string } | { kind: "header" } | { kind: "footer" } | { kind: "theme" } | { kind: "page" };

type SectionActions = {
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
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

function SortableSection({ section, ctx, selected, index, count, actions }: { section: Section; ctx: StorefrontCtx; selected: boolean; index: number; count: number; actions: SectionActions }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const def = SECTION_MAP[section.type];
  return (
    <div
      data-section-id={section.id}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative", isDragging && "z-30 opacity-60")}
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
          <button className={TB} onClick={() => actions.onToggle(section.id)} aria-label={section.hidden ? "Show" : "Hide"}>{section.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
          <button className={TB} onClick={() => actions.onDelete(section.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
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
        <RenderSection section={section} ctx={ctx} />
      )}
    </div>
  );
}

function GlobalSection({ section, ctx, selected, onSelect, label }: { section: Section; ctx: StorefrontCtx; selected: boolean; onSelect: () => void; label: string }) {
  return (
    <div className="group relative" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <div className={cn("pointer-events-none absolute inset-0 z-10", selected ? "ring-2 ring-inset ring-brand-600" : "group-hover:ring-2 group-hover:ring-inset group-hover:ring-brand-500/50")} />
      {selected && <Toolbar label={`${label} · all pages`} />}
      <RenderSection section={section} ctx={ctx} />
    </div>
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
  config, pageId, ctx, device, selection, setSelection, actions,
}: {
  config: SiteConfig;
  pageId: string;
  ctx: StorefrontCtx;
  device: "desktop" | "mobile";
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  actions: SectionActions;
}) {
  const page = config.pages.find((p) => p.id === pageId) ?? config.pages[0];
  const sel = selection?.kind === "section" ? selection.id : null;
  return (
    <div
      className={cn("mx-auto bg-white shadow-lg transition-[width] duration-300", device === "mobile" ? "w-[390px] overflow-hidden rounded-[28px] border-8 border-zinc-900" : "w-full max-w-[1280px]")}
      onClickCapture={(e) => {
        // Links are inert inside the editor.
        if ((e.target as HTMLElement).closest("a")) e.preventDefault();
      }}
      onClick={() => setSelection(null)}
    >
      <div style={themeVars(config.theme)} className="@container min-h-[70vh]">
        <GlobalSection section={config.header} ctx={ctx} selected={selection?.kind === "header"} onSelect={() => setSelection({ kind: "header" })} label="Navigation bar" />
        <SortableContext items={page.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {page.sections.map((s, i) => (
            <SortableSection key={s.id} section={s} ctx={ctx} selected={sel === s.id} index={i} count={page.sections.length} actions={actions} />
          ))}
        </SortableContext>
        <DropZone empty={page.sections.length === 0} />
        <GlobalSection section={config.footer} ctx={ctx} selected={selection?.kind === "footer"} onSelect={() => setSelection({ kind: "footer" })} label="Footer" />
      </div>
    </div>
  );
}
