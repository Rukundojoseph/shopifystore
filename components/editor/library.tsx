"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  Megaphone, Image as ImageIcon, Type, Images, LayoutGrid, Tags, BadgePercent, Quote, Mail, Phone, MousePointerClick, MoveVertical, Sparkles, PanelTop,
} from "lucide-react";
import { PLACEABLE_SECTIONS, type SectionDef } from "@/lib/editor/sections";

export const SECTION_ICONS: Record<string, typeof Type> = {
  announcement: Megaphone, hero: PanelTop, features: Sparkles, text: Type, image: ImageIcon, gallery: Images,
  "product-grid": LayoutGrid, categories: Tags, "promo-banner": BadgePercent, testimonials: Quote, newsletter: Mail,
  contact: Phone, button: MousePointerClick, spacer: MoveVertical,
};

function LibraryItem({ def, onAdd }: { def: SectionDef; onAdd: (type: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lib:${def.type}`, data: { fromLibrary: true, type: def.type } });
  const Icon = SECTION_ICONS[def.type] ?? Type;
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAdd(def.type)}
      className={`flex w-full cursor-grab items-start gap-3 rounded-lg border border-zinc-200 bg-white p-2.5 text-left transition hover:border-brand-500 hover:shadow-sm active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
      title="Drag onto the page or click to add"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-900">{def.label}</span>
        <span className="block truncate text-xs text-zinc-500">{def.description}</span>
      </span>
    </button>
  );
}

export function ComponentLibrary({ onAdd }: { onAdd: (type: string) => void }) {
  const groups = ["Content", "Commerce", "Engagement", "Layout"] as const;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{g}</p>
          <div className="flex flex-col gap-1.5">
            {PLACEABLE_SECTIONS.filter((d) => d.group === g).map((d) => <LibraryItem key={d.type} def={d} onAdd={onAdd} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
