"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  Megaphone, Image as ImageIcon, Type, Images, LayoutGrid, Tags, BadgePercent, Quote, Mail, Phone, MousePointerClick, MoveVertical, Sparkles, PanelTop,
  Heading, Pilcrow, RectangleHorizontal, SeparatorHorizontal, Star, Youtube, Square, Bookmark, Trash2, LayoutTemplate,
  Search, ClipboardList, TextCursorInput, AlignLeft, ChevronDownSquare, CheckSquare, BadgeCheck, MenuSquare, ShoppingBag,
  LayoutDashboard, ImagePlus, Tag, Banknote, ShoppingCart,
} from "lucide-react";
import { PLACEABLE_SECTIONS, type SectionDef } from "@/lib/editor/sections";
import { CONTAINER_PRESETS } from "@/lib/editor/nodes";
import type { NodeType, SavedTemplateItem } from "@/lib/editor/schema";
import { cn } from "@/components/ui";

export const SECTION_ICONS: Record<string, typeof Type> = {
  announcement: Megaphone, hero: PanelTop, features: Sparkles, text: Type, image: ImageIcon, gallery: Images,
  "product-grid": LayoutGrid, categories: Tags, "promo-banner": BadgePercent, testimonials: Quote, newsletter: Mail,
  contact: Phone, button: MousePointerClick, spacer: MoveVertical, custom: LayoutTemplate,
};

export const ELEMENT_ICONS: Record<NodeType, typeof Type> = {
  container: Square, heading: Heading, text: Pilcrow, image: ImageIcon, button: RectangleHorizontal,
  spacer: MoveVertical, divider: SeparatorHorizontal, icon: Star, video: Youtube,
  search: Search, form: ClipboardList, input: TextCursorInput, textarea: AlignLeft, select: ChevronDownSquare, checkbox: CheckSquare,
  logo: BadgeCheck, menu: MenuSquare, cart: ShoppingBag,
  products: LayoutDashboard, "product-image": ImagePlus, "product-name": Tag, "product-price": Banknote, "product-button": ShoppingCart,
};

/** What a palette item inserts: a single element, a column layout, or a saved block. */
export type ElementSpec = { element: NodeType; props?: Record<string, string | number | boolean> } | { preset: string } | { saved: string };

const ELEMENTS: { type: NodeType; label: string }[] = [
  { type: "container", label: "Container" }, { type: "heading", label: "Heading" }, { type: "text", label: "Text" },
  { type: "image", label: "Image" }, { type: "button", label: "Button" }, { type: "icon", label: "Icon" },
  { type: "divider", label: "Divider" }, { type: "spacer", label: "Spacer" }, { type: "video", label: "Video" },
  { type: "search", label: "Search" },
];

const NAV_ELEMENTS: { type: NodeType; label: string }[] = [
  { type: "logo", label: "Logo" }, { type: "menu", label: "Menu" }, { type: "cart", label: "Cart" },
];

const SHOP_ELEMENTS: { type: NodeType; label: string }[] = [
  { type: "products", label: "Product grid" }, { type: "product-image", label: "Product image" }, { type: "product-name", label: "Product name" },
  { type: "product-price", label: "Price" }, { type: "product-button", label: "Add to cart" },
];

const FORM_ELEMENTS: { type: NodeType; label: string }[] = [
  { type: "form", label: "Form" }, { type: "input", label: "Input" }, { type: "textarea", label: "Text area" },
  { type: "select", label: "Dropdown" }, { type: "checkbox", label: "Checkbox" },
];

const BUTTON_PRESETS: { label: string; props: Record<string, string> }[] = [
  { label: "Primary", props: { variant: "solid", text: "Shop now" } },
  { label: "Secondary", props: { variant: "secondary", text: "Learn more" } },
  { label: "Outline", props: { variant: "outline", text: "View all" } },
  { label: "Dark", props: { variant: "dark", text: "Get started" } },
  { label: "Large", props: { variant: "solid", size: "lg", text: "Order now" } },
  { label: "Text link", props: { variant: "link", text: "Read more" } },
];

function LibraryItem({ def, onAdd }: { def: SectionDef; onAdd: (type: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lib:${def.type}`, data: { fromLibrary: true, type: def.type, label: def.label } });
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

/** Draggable palette tile: drop into a container, or onto the page to start a custom section. */
function Tile({ id, spec, label, onAdd, children, className }: { id: string; spec: ElementSpec; label: string; onAdd: (s: ElementSpec) => void; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { kind: "element", spec, label } });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAdd(spec)}
      title={`${label} — drag into the page or a container, or click to add`}
      className={cn("flex cursor-grab flex-col items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white p-2 text-[11px] font-medium text-zinc-700 transition hover:border-brand-500 hover:text-brand-700 active:cursor-grabbing", isDragging && "opacity-40", className)}
    >
      {children}
    </button>
  );
}

function PresetIcon({ columns }: { columns: number[] }) {
  return (
    <span className="flex h-6 w-full gap-0.5">
      {columns.map((c, i) => <span key={i} className="rounded-sm bg-zinc-300" style={{ flex: c }} />)}
    </span>
  );
}

export function ComponentLibrary({ onAdd, onAddElement, saved, onDeleteSaved }: {
  onAdd: (type: string) => void;
  onAddElement: (spec: ElementSpec) => void;
  saved: SavedTemplateItem[];
  onDeleteSaved: (id: string) => void;
}) {
  const groups = ["Content", "Commerce", "Engagement", "Layout"] as const;
  const blocks = saved.filter((s) => s.kind === "BLOCK");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Layout</p>
        <div className="grid grid-cols-3 gap-1.5">
          {CONTAINER_PRESETS.map((p) => (
            <Tile key={p.key} id={`el:preset:${p.key}`} spec={{ preset: p.key }} label={p.label} onAdd={onAddElement}>
              <PresetIcon columns={p.columns} /> {p.label}
            </Tile>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Elements</p>
        <div className="grid grid-cols-3 gap-1.5">
          {ELEMENTS.map(({ type, label }) => {
            const Icon = ELEMENT_ICONS[type];
            return <Tile key={type} id={`el:${type}`} spec={{ element: type }} label={label} onAdd={onAddElement} className="aspect-square"><Icon className="h-5 w-5" /> {label}</Tile>;
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Navigation</p>
        <div className="grid grid-cols-3 gap-1.5">
          {NAV_ELEMENTS.map(({ type, label }) => {
            const Icon = ELEMENT_ICONS[type];
            return <Tile key={type} id={`el:${type}`} spec={{ element: type }} label={label} onAdd={onAddElement} className="aspect-square"><Icon className="h-5 w-5" /> {label}</Tile>;
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Shop</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SHOP_ELEMENTS.map(({ type, label }) => {
            const Icon = ELEMENT_ICONS[type];
            return <Tile key={type} id={`el:${type}`} spec={{ element: type }} label={label} onAdd={onAddElement} className="aspect-square"><Icon className="h-5 w-5" /> {label}</Tile>;
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500">A product grid repeats its card for every product. Design the first card — add any element, like an input named <code>quantity</code>.</p>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Forms</p>
        <div className="grid grid-cols-3 gap-1.5">
          {FORM_ELEMENTS.map(({ type, label }) => {
            const Icon = ELEMENT_ICONS[type];
            return <Tile key={type} id={`el:${type}`} spec={{ element: type }} label={label} onAdd={onAddElement} className="aspect-square"><Icon className="h-5 w-5" /> {label}</Tile>;
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Buttons</p>
        <div className="grid grid-cols-2 gap-1.5">
          {BUTTON_PRESETS.map((b) => (
            <Tile key={b.label} id={`el:button:${b.label}`} spec={{ element: "button", props: b.props }} label={`${b.label} button`} onAdd={onAddElement} className="py-2.5">
              <span className={cn("rounded px-2 py-1 text-[10px] font-semibold",
                b.props.variant === "solid" ? "bg-brand-600 text-white" : b.props.variant === "secondary" ? "bg-zinc-100 text-zinc-800" : b.props.variant === "outline" ? "border border-zinc-800" : b.props.variant === "dark" ? "bg-zinc-900 text-white" : "text-brand-700 underline")}>{b.props.text}</span>
              {b.label}
            </Tile>
          ))}
        </div>
      </div>
      {blocks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Saved blocks</p>
          <div className="flex flex-col gap-1.5">
            {blocks.map((b) => (
              <div key={b.id} className="group relative">
                <Tile id={`el:saved:${b.id}`} spec={{ saved: b.id }} label={b.name} onAdd={onAddElement} className="flex-row justify-start gap-2 p-2.5 text-left text-sm">
                  <Bookmark className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="truncate">{b.name}</span>
                </Tile>
                <button onClick={() => { if (confirm(`Delete saved block "${b.name}"?`)) onDeleteSaved(b.id); }} className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 group-hover:block" aria-label={`Delete ${b.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <hr className="border-zinc-200" />
      <p className="-mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Ready-made sections</p>
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
