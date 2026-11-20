"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, Eye, EyeOff, Plus, Trash2, Zap, ArrowRight } from "lucide-react";
import { PARENT_TYPES, type Condition, type Conditional, type LayoutNode, type SiteConfig, type Style, type Workflow } from "@/lib/editor/schema";
import { newNodeId } from "@/lib/editor/nodes";
import { cn } from "@/components/ui";
import { FloatingPanel } from "./floating";
import { NumberInput, Tabs, inputCls } from "./controls";
import { AdvancedTab, LayoutGroup, StyleTab, elementLabel, type StyleSetter } from "./style-panel";
import { NodePicker } from "./workflows";
import { actionSummary, conditionSummary, indexNodes, pageRefs, triggerSummary, type NodeRef } from "./workflow-meta";
import type { StorefrontProduct } from "@/components/storefront/types";

const lbl = "mb-1 block text-xs font-medium text-zinc-600";

const CONDITION_TYPES: { type: Condition["type"]; label: string }[] = [
  { type: "hover", label: "This element is hovered" },
  { type: "pressed", label: "This element is pressed" },
  { type: "focus", label: "A field inside is focused" },
  { type: "clicked", label: "This element has been clicked (toggles)" },
  { type: "state", label: "Another element's state is on" },
  { type: "scrolled", label: "The page is scrolled past…" },
  { type: "width", label: "The page width is… (responsive)" },
];

function defaultCondition(type: Condition["type"]): Condition {
  switch (type) {
    case "state": return { type, nodeId: "pick-element" };
    case "scrolled": return { type, offset: 200 };
    case "width": return { type, max: 767 };
    default: return { type } as Condition;
  }
}

function ConditionCard({ c, node, nodes, open, onOpen, onChange, onDelete, previewing, onPreview, themeVars }: {
  c: Conditional; node: LayoutNode; nodes: NodeRef[]; open: boolean; onOpen: () => void;
  onChange: (c: Conditional) => void; onDelete: () => void; previewing: boolean; onPreview: () => void; themeVars: CSSProperties;
}) {
  const [tab, setTab] = useState<"style" | "layout">("style");
  // The condition's style is one flat layer; reuse the full style controls on it.
  const set: StyleSetter = (key, value) => {
    const style: Style = { ...c.style };
    if (value === undefined || value === null) delete style[key]; else (style as Record<string, unknown>)[key] = value;
    onChange({ ...c, style });
  };
  const api = { rs: { desktop: c.style }, device: "desktop" as const, set, themeVars };
  const changed = Object.keys(c.style).length;
  const w = c.when;
  return (
    <div className={cn("rounded-lg border", open ? "border-brand-400" : "border-zinc-200")}>
      <div className="flex items-center gap-1 px-2.5 py-2">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm">
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition", !open && "-rotate-90")} />
          <span className="truncate font-medium">{conditionSummary(w, nodes)}</span>
          <span className="shrink-0 text-[11px] text-zinc-400">{changed} change{changed === 1 ? "" : "s"}</span>
        </button>
        <button onClick={onPreview} className={cn("rounded p-1", previewing ? "bg-brand-100 text-brand-700" : "text-zinc-400 hover:bg-zinc-100")} title={previewing ? "Stop previewing" : "Preview on the canvas"}>{previewing ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
        <button onClick={onDelete} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Delete condition"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {open && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 p-3">
          <div>
            <span className={lbl}>When</span>
            <select className={inputCls} value={w.type} onChange={(e) => onChange({ ...c, when: defaultCondition(e.target.value as Condition["type"]) })}>
              {CONDITION_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </div>
          {w.type === "state" && <div><span className={lbl}>Element</span><NodePicker nodes={nodes} value={w.nodeId} onChange={(id) => id && onChange({ ...c, when: { ...w, nodeId: id } })} /><p className="mt-1 text-[11px] text-zinc-500">Turn its state on/off with a workflow step “Toggle an element&apos;s state”.</p></div>}
          {w.type === "scrolled" && <div><span className={lbl}>Scrolled past</span><NumberInput value={w.offset} onChange={(v) => onChange({ ...c, when: { ...w, offset: v ?? 0 } })} min={0} max={20000} suffix="px" /></div>}
          {w.type === "width" && (
            <div className="grid grid-cols-2 gap-2">
              <div><span className={lbl}>Min width</span><NumberInput value={w.min} onChange={(v) => onChange({ ...c, when: { ...w, min: v } })} min={0} max={4000} suffix="px" placeholder="any" /></div>
              <div><span className={lbl}>Max width</span><NumberInput value={w.max} onChange={(v) => onChange({ ...c, when: { ...w, max: v } })} min={0} max={4000} suffix="px" placeholder="any" /></div>
              <p className="col-span-2 text-[11px] text-zinc-500">Any width you like, beyond the Desktop / Tablet / Mobile presets. Phones are usually ≤ 767px, tablets ≤ 1024px.</p>
            </div>
          )}
          {w.type === "clicked" && <p className="text-[11px] text-zinc-500">Each click turns this on, the next click turns it off again — e.g. change the colour of a selected button.</p>}
          <p className="-mb-1 text-xs font-semibold text-zinc-700">…then change</p>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "style", label: "Style" }, { value: "layout", label: "Size, spacing & visibility" }]} />
          {tab === "style" ? <StyleTab api={api} /> : (
            <div className="flex flex-col gap-4">
              {PARENT_TYPES.has(node.type) && <LayoutGroup api={api} />}
              <AdvancedTab api={api} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Movable dialog for one element: its conditions and the workflows it triggers. */
export function ElementLogicDialog({ node, config, onClose, setConditions, setWorkflows, openWorkflow, previewId, setPreviewId, themeVars, products }: {
  node: LayoutNode;
  config: SiteConfig;
  onClose: () => void;
  setConditions: (fn: (c: Conditional[]) => Conditional[], key?: string) => void;
  setWorkflows: (fn: (w: Workflow[]) => Workflow[]) => void;
  openWorkflow: (id: string) => void;
  previewId: string | null;
  setPreviewId: (id: string | null) => void;
  themeVars: CSSProperties;
  products: StorefrontProduct[];
}) {
  const [tab, setTab] = useState<"conditions" | "workflows">("conditions");
  const conditions = node.conditions ?? [];
  const [openId, setOpenId] = useState<string | null>(conditions[0]?.id ?? null);
  const nodes = useMemo(() => indexNodes(config), [config]);
  const pages = useMemo(() => pageRefs(config), [config]);
  const mine = (config.workflows ?? []).filter((w) => (w.trigger.type === "click" || w.trigger.type === "submit") && w.trigger.nodeId === node.id);

  function addCondition() {
    const c: Conditional = { id: newNodeId("cond"), when: { type: "hover" }, style: {} };
    setConditions((list) => [...list, c]);
    setOpenId(c.id);
  }
  function addWorkflow(type: "click" | "submit") {
    const wf: Workflow = { id: newNodeId("wf"), name: `${elementLabel(node.type)} ${type === "submit" ? "submitted" : "clicked"}`, trigger: { type, nodeId: node.id }, actions: [] };
    setWorkflows((l) => [...l, wf]);
    openWorkflow(wf.id);
  }

  return (
    <FloatingPanel title={`${elementLabel(node.type)} — logic`} subtitle="Conditions change styles; workflows run actions" onClose={() => { setPreviewId(null); onClose(); }} width={380}>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "conditions", label: `Conditions (${conditions.length})` }, { value: "workflows", label: `Workflows (${mine.length})` }]} />
      {tab === "conditions" ? (
        <div className="flex flex-col gap-2">
          {!conditions.length && <p className="text-sm text-zinc-500">Change how this element looks <b>when</b> something is true: hover, click, scroll, or a page-width range for fine responsive control.</p>}
          {conditions.map((c) => (
            <ConditionCard
              key={c.id}
              c={c}
              node={node}
              nodes={nodes}
              open={openId === c.id}
              onOpen={() => setOpenId(openId === c.id ? null : c.id)}
              onChange={(next) => setConditions((list) => list.map((x) => (x.id === c.id ? next : x)), `cond:${c.id}`)}
              onDelete={() => { setConditions((list) => list.filter((x) => x.id !== c.id)); if (previewId === c.id) setPreviewId(null); }}
              previewing={previewId === c.id}
              onPreview={() => setPreviewId(previewId === c.id ? null : c.id)}
              themeVars={themeVars}
            />
          ))}
          {conditions.length < 20 && (
            <button onClick={addCondition} className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-sm text-zinc-600 hover:border-brand-500 hover:text-brand-700"><Plus className="h-4 w-4" /> Add a condition</button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {!mine.length && <p className="text-sm text-zinc-500">No workflows start from this element yet.</p>}
          {mine.map((w) => (
            <button key={w.id} onClick={() => openWorkflow(w.id)} className="group flex flex-col gap-1 rounded-lg border border-zinc-200 p-2.5 text-left hover:border-brand-400">
              <span className="flex items-center gap-1.5 text-sm font-medium"><Zap className="h-3.5 w-3.5 text-orange-500" />{w.name || "Untitled"}{w.disabled && <span className="text-[11px] text-zinc-400">(off)</span>}<ArrowRight className="ml-auto h-3.5 w-3.5 text-zinc-300 group-hover:text-brand-600" /></span>
              <span className="text-[11px] text-zinc-500">{triggerSummary(w.trigger, nodes, pages)}</span>
              {w.actions.slice(0, 3).map((a, i) => <span key={a.id} className="text-[11px] text-zinc-600">{i + 1}. {actionSummary(a, nodes, products)}</span>)}
              {w.actions.length > 3 && <span className="text-[11px] text-zinc-400">+{w.actions.length - 3} more</span>}
            </button>
          ))}
          {node.type === "form" ? (
            <button onClick={() => addWorkflow("submit")} className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-sm text-zinc-600 hover:border-brand-500 hover:text-brand-700"><Plus className="h-4 w-4" /> When this form is submitted…</button>
          ) : (
            <button onClick={() => addWorkflow("click")} className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-sm text-zinc-600 hover:border-brand-500 hover:text-brand-700"><Plus className="h-4 w-4" /> When this is clicked…</button>
          )}
          <p className="text-[11px] text-zinc-500">Workflows open on their own page (top bar → Workflows).</p>
        </div>
      )}
    </FloatingPanel>
  );
}
