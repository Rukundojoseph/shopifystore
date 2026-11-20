"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, EyeOff } from "lucide-react";
import type { LayoutNode, Section } from "@/lib/editor/schema";
import { SECTION_MAP } from "@/lib/editor/sections";
import { effectiveStyle } from "@/lib/editor/nodes";
import { cn } from "@/components/ui";
import type { Selection } from "./canvas";
import { ELEMENT_ICONS, SECTION_ICONS } from "./library";
import { elementLabel } from "./style-panel";

// Layer tree (Elementor's "Navigator"): sections and, for custom sections,
// every nested container and element. Precise selection for deep layouts.

function nodeText(n: LayoutNode): string {
  const t = typeof n.props.text === "string" ? n.props.text : "";
  return t ? `${elementLabel(n.type)} · ${t.slice(0, 28)}` : elementLabel(n.type);
}

function NodeRow({ node, sectionId, depth, selection, onSelect, onShift }: {
  node: LayoutNode; sectionId: string; depth: number; selection: Selection | null;
  onSelect: (s: Selection) => void; onShift: (sectionId: string, nodeId: string, dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(true);
  const Icon = ELEMENT_ICONS[node.type];
  const active = selection?.kind === "node" && selection.nodeId === node.id;
  const hidden = !!effectiveStyle(node.style, "desktop").hidden;
  return (
    <li>
      <div className={cn("group flex items-center gap-1 rounded-md pr-1 text-xs", active ? "bg-brand-50 text-brand-700" : "hover:bg-zinc-100")} style={{ paddingLeft: depth * 12 }}>
        {node.children?.length ? (
          <button onClick={() => setOpen((o) => !o)} className="p-0.5 text-zinc-400" aria-label={open ? "Collapse" : "Expand"}><ChevronRight className={cn("h-3 w-3 transition", open && "rotate-90")} /></button>
        ) : <span className="w-4" />}
        <button onClick={() => onSelect({ kind: "node", sectionId, nodeId: node.id })} className={cn("flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left", hidden && "opacity-50")}>
          <Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{nodeText(node)}</span>
          {hidden && <EyeOff className="h-3 w-3 shrink-0" />}
        </button>
        <span className="hidden gap-0.5 group-hover:flex">
          <button onClick={() => onShift(sectionId, node.id, -1)} className="rounded p-0.5 hover:bg-zinc-200" aria-label="Move up"><ArrowUp className="h-3 w-3" /></button>
          <button onClick={() => onShift(sectionId, node.id, 1)} className="rounded p-0.5 hover:bg-zinc-200" aria-label="Move down"><ArrowDown className="h-3 w-3" /></button>
        </span>
      </div>
      {open && node.children?.length ? (
        <ul>{node.children.map((c) => <NodeRow key={c.id} node={c} sectionId={sectionId} depth={depth + 1} selection={selection} onSelect={onSelect} onShift={onShift} />)}</ul>
      ) : null}
    </li>
  );
}

export function Navigator({ sections, headerNodes, navNodes, barNodes, selection, onSelect, onShift, onMoveSection }: {
  sections: Section[];
  /** Elements in the header's custom information bar (shown on every page). */
  headerNodes?: LayoutNode[];
  /** The merchant's own elements inside the navigation bar row. */
  navNodes?: LayoutNode[];
  /** A fully custom navigation bar. */
  barNodes?: LayoutNode[];
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  onShift: (sectionId: string, nodeId: string, dir: -1 | 1) => void;
  onMoveSection: (id: string, dir: -1 | 1) => void;
}) {
  const row = (active: boolean) => cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", active ? "bg-brand-50 text-brand-700" : "hover:bg-zinc-100");
  return (
    <ul className="flex flex-col gap-0.5">
      <li>
        <button onClick={() => onSelect({ kind: "header" })} className={row(selection?.kind === "header")}>Navigation bar</button>
        {headerNodes?.length ? (
          <ul className="ml-2 border-l border-zinc-200 pl-1">
            <li className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Information bar</li>
            {headerNodes.map((n) => <NodeRow key={n.id} node={n} sectionId="header" depth={0} selection={selection} onSelect={onSelect} onShift={onShift} />)}
          </ul>
        ) : null}
        {barNodes?.length ? (
          <ul className="ml-2 border-l border-zinc-200 pl-1">
            <li className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Custom navigation bar</li>
            {barNodes.map((n) => <NodeRow key={n.id} node={n} sectionId="header-bar" depth={0} selection={selection} onSelect={onSelect} onShift={onShift} />)}
          </ul>
        ) : null}
        {navNodes?.length ? (
          <ul className="ml-2 border-l border-zinc-200 pl-1">
            <li className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">In the navigation bar</li>
            {navNodes.map((n) => <NodeRow key={n.id} node={n} sectionId="header-nav" depth={0} selection={selection} onSelect={onSelect} onShift={onShift} />)}
          </ul>
        ) : null}
      </li>
      {sections.map((s) => {
        const Icon = SECTION_ICONS[s.type];
        const active = selection?.kind === "section" && selection.id === s.id;
        return (
          <li key={s.id}>
            <div className="group flex items-center">
              <button onClick={() => onSelect({ kind: "section", id: s.id })} className={cn(row(active), "flex-1", s.hidden && "opacity-50")}>
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{String(s.settings.heading || s.settings.text || SECTION_MAP[s.type]?.label)}</span>
              </button>
              <span className="hidden gap-0.5 group-hover:flex">
                <button onClick={() => onMoveSection(s.id, -1)} className="rounded p-0.5 hover:bg-zinc-200" aria-label="Move section up"><ArrowUp className="h-3 w-3" /></button>
                <button onClick={() => onMoveSection(s.id, 1)} className="rounded p-0.5 hover:bg-zinc-200" aria-label="Move section down"><ArrowDown className="h-3 w-3" /></button>
              </span>
            </div>
            {s.type === "custom" && s.nodes?.length ? (
              <ul className="ml-2 border-l border-zinc-200 pl-1">
                {s.nodes.map((n) => <NodeRow key={n.id} node={n} sectionId={s.id} depth={0} selection={selection} onSelect={onSelect} onShift={onShift} />)}
              </ul>
            ) : null}
          </li>
        );
      })}
      <li><button onClick={() => onSelect({ kind: "footer" })} className={row(selection?.kind === "footer")}>Footer</button></li>
    </ul>
  );
}
