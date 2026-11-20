"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Copy, Lock, Plus, Search, Trash2, Zap, MousePointerClick, Send, FileText, MoveDown, AlertTriangle } from "lucide-react";
import { ORDER_STATUSES, type SiteConfig, type Trigger, type Workflow, type WorkflowAction } from "@/lib/editor/schema";
import { newNodeId } from "@/lib/editor/nodes";
import type { StorefrontProduct } from "@/components/storefront/types";
import { cn } from "@/components/ui";
import { FloatingPanel } from "./floating";
import { ButtonGroup, NumberInput, Toggle, inputCls } from "./controls";
import { LinkField, type LinkOption } from "./properties";
import {
  ACTIONS, ACTION_META, actionSummary, conditionSummary, formFields, indexNodes, newWorkflow, pageRefs, triggerSummary, type NodeRef,
} from "./workflow-meta";

const lbl = "mb-1 block text-xs font-medium text-zinc-600";

/** Pick any element on any page (optionally only some types). */
export function NodePicker({ nodes, value, onChange, types, allowNone, noneLabel = "— none —" }: {
  nodes: NodeRef[]; value: string | undefined; onChange: (id: string | undefined) => void; types?: string[]; allowNone?: boolean; noneLabel?: string;
}) {
  const list = types ? nodes.filter((n) => types.includes(n.type)) : nodes;
  const byPage = new Map<string, NodeRef[]>();
  for (const n of list) byPage.set(n.pageName, [...(byPage.get(n.pageName) ?? []), n]);
  return (
    <select className={inputCls} value={value && value !== "pick-element" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="" disabled={!allowNone}>{allowNone ? noneLabel : "Choose an element…"}</option>
      {[...byPage].map(([page, items]) => (
        <optgroup key={page} label={page}>
          {items.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function WhenEditor({ when, onChange, nodes }: { when: Workflow["when"]; onChange: (w: Workflow["when"]) => void; nodes: NodeRef[] }) {
  return (
    <div className="flex flex-col gap-2">
      <select className={inputCls} value={when?.type ?? ""} onChange={(e) => {
        const t = e.target.value;
        onChange(t === "width" ? { type: "width", max: 767 } : t === "scrolled" ? { type: "scrolled", offset: 300 } : t === "state" ? { type: "state", nodeId: "pick-element" } : undefined);
      }}>
        <option value="">Always</option>
        <option value="width">Page width is in a range</option>
        <option value="scrolled">Page is scrolled past…</option>
        <option value="state">An element&apos;s state is on</option>
      </select>
      {when?.type === "width" && (
        <div className="grid grid-cols-2 gap-2">
          <div><span className={lbl}>Min width</span><NumberInput value={when.min} onChange={(v) => onChange({ ...when, min: v })} min={0} max={4000} suffix="px" placeholder="any" /></div>
          <div><span className={lbl}>Max width</span><NumberInput value={when.max} onChange={(v) => onChange({ ...when, max: v })} min={0} max={4000} suffix="px" placeholder="any" /></div>
        </div>
      )}
      {when?.type === "scrolled" && <NumberInput value={when.offset} onChange={(v) => onChange({ ...when, offset: v ?? 0 })} min={0} max={20000} suffix="px" />}
      {when?.type === "state" && <NodePicker nodes={nodes} value={when.nodeId} onChange={(id) => id && onChange({ ...when, nodeId: id })} />}
    </div>
  );
}

function TriggerEditor({ wf, onChange, nodes, pages }: { wf: Workflow; onChange: (w: Workflow) => void; nodes: NodeRef[]; pages: { id: string; name: string }[] }) {
  const t = wf.trigger;
  const setT = (trigger: Trigger) => onChange({ ...wf, trigger });
  return (
    <div className="flex flex-col gap-4">
      <div><span className={lbl}>Workflow name</span><input className={inputCls} value={wf.name} maxLength={80} onChange={(e) => onChange({ ...wf, name: e.target.value })} /></div>
      <div>
        <span className={lbl}>Event</span>
        <select className={inputCls} value={t.type} onChange={(e) => {
          const type = e.target.value as Trigger["type"];
          setT(type === "click" ? { type, nodeId: "pick-element" } : type === "submit" ? { type, nodeId: "pick-element" } : type === "pageLoad" ? { type, pageId: pages[0]?.id ?? "home" } : { type: "scroll", pageId: pages[0]?.id ?? "home", offset: 300 });
        }}>
          <option value="click">An element is clicked</option>
          <option value="submit">A form is submitted</option>
          <option value="pageLoad">A page is loaded</option>
          <option value="scroll">A page is scrolled</option>
        </select>
      </div>
      {(t.type === "click" || t.type === "submit") && (
        <div><span className={lbl}>{t.type === "click" ? "Element" : "Form"}</span><NodePicker nodes={nodes} value={t.nodeId} types={t.type === "submit" ? ["form"] : undefined} onChange={(id) => id && setT({ ...t, nodeId: id })} /></div>
      )}
      {(t.type === "pageLoad" || t.type === "scroll") && (
        <div>
          <span className={lbl}>Page</span>
          <select className={inputCls} value={t.pageId} onChange={(e) => setT({ ...t, pageId: e.target.value })}>{pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>
      )}
      {t.type === "scroll" && <div><span className={lbl}>Scrolled past</span><NumberInput value={t.offset} onChange={(v) => setT({ ...t, offset: v ?? 0 })} min={0} max={20000} suffix="px" /></div>}
      <div>
        <span className={lbl}>Only when</span>
        <WhenEditor when={wf.when} onChange={(when) => onChange({ ...wf, when })} nodes={nodes} />
        <p className="mt-1 text-[11px] text-zinc-500">Use page width to run different steps on phones and desktops.</p>
      </div>
      <label className="flex items-center justify-between text-sm text-zinc-700">Workflow is on<Toggle checked={!wf.disabled} onChange={(v) => onChange({ ...wf, disabled: v ? undefined : true })} /></label>
    </div>
  );
}

function OrderRef({ a, set, fields }: { a: Extract<WorkflowAction, { type: "cancelOrder" | "setOrderStatus" | "deleteOrder" }>; set: (a: WorkflowAction) => void; fields: string[] }) {
  const fromField = a.orderNumber === undefined;
  return (
    <div className="flex flex-col gap-2">
      <span className={lbl}>Which order</span>
      <ButtonGroup value={fromField ? "field" : "fixed"} onChange={(v) => set(v === "field" ? { ...a, orderNumber: undefined, orderField: a.orderField ?? fields[0] ?? "order" } : { ...a, orderField: undefined, orderNumber: a.orderNumber ?? 1 })} options={[{ value: "field", label: "From a form field" }, { value: "fixed", label: "A fixed number" }]} />
      {fromField ? (
        fields.length ? (
          <select className={inputCls} value={a.orderField ?? ""} onChange={(e) => set({ ...a, orderField: e.target.value })}>{fields.map((f) => <option key={f}>{f}</option>)}</select>
        ) : (
          <input className={cn(inputCls, "font-mono")} value={a.orderField ?? ""} placeholder="order" onChange={(e) => set({ ...a, orderField: e.target.value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40) })} />
        )
      ) : (
        <NumberInput value={a.orderNumber} onChange={(v) => set({ ...a, orderNumber: v ?? 1 })} min={1} max={10_000_000} />
      )}
      <p className="text-[11px] text-zinc-500">{fromField ? "The visitor types an order number into this form field (e.g. an Input named “order”)." : "Always acts on this order number."}</p>
    </div>
  );
}

function ActionEditor({ a, set, nodes, links, products, fields }: {
  a: WorkflowAction; set: (a: WorkflowAction) => void; nodes: NodeRef[]; links: LinkOption[]; products: StorefrontProduct[]; fields: string[];
}) {
  const meta = ACTION_META[a.type];
  return (
    <div className="flex flex-col gap-3">
      {meta.staff && (
        <p className="flex gap-2 rounded-md bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Runs only for signed-in staff of this store with permission to update orders (checked on the server). For everyone else nothing happens.
        </p>
      )}
      {a.type === "goToPage" && <div><span className={lbl}>Destination</span><LinkField value={a.to} onChange={(to) => set({ ...a, to })} links={links} /></div>}
      {a.type === "openUrl" && (
        <>
          <div><span className={lbl}>Website address</span><input className={inputCls} value={a.url} onChange={(e) => set({ ...a, url: e.target.value })} placeholder="https://…" /></div>
          <label className="flex items-center justify-between text-sm text-zinc-700">Open in a new tab<Toggle checked={!!a.newTab} onChange={(v) => set({ ...a, newTab: v })} /></label>
        </>
      )}
      {a.type === "scrollTo" && <div><span className={lbl}>Scroll to</span><NodePicker nodes={nodes} value={a.nodeId} allowNone noneLabel="Top of the page" onChange={(nodeId) => set({ ...a, nodeId })} /></div>}
      {(a.type === "show" || a.type === "hide" || a.type === "toggle" || a.type === "toggleState") && (
        <div>
          <span className={lbl}>Element</span>
          <NodePicker nodes={nodes} value={a.nodeId} onChange={(nodeId) => nodeId && set({ ...a, nodeId })} />
          {a.type === "show" && <p className="mt-1 text-[11px] text-zinc-500">Tip: hide the element on all devices in its Advanced tab so it starts hidden, then show it here.</p>}
          {a.type === "toggleState" && <p className="mt-1 text-[11px] text-zinc-500">Pair with a condition “When this element&apos;s state is on” to change styles.</p>}
        </div>
      )}
      {a.type === "showMessage" && <div><span className={lbl}>Message</span><textarea rows={2} maxLength={300} className={inputCls} value={a.text} onChange={(e) => set({ ...a, text: e.target.value })} /></div>}
      {a.type === "wait" && <div><span className={lbl}>Wait for</span><NumberInput value={a.ms / 1000} onChange={(v) => set({ ...a, ms: Math.round((v ?? 1) * 1000) })} min={0} max={10} step={0.1} suffix="seconds" /></div>}
      {a.type === "addToCart" && (
        <>
          <div>
            <span className={lbl}>Product</span>
            <select className={inputCls} value={a.productId} onChange={(e) => set({ ...a, productId: e.target.value })}>
              <option value="" disabled>Choose a product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.hasVariants ? " (opens product page to pick options)" : ""}</option>)}
            </select>
          </div>
          <div><span className={lbl}>Quantity</span><NumberInput value={a.quantity} onChange={(v) => set({ ...a, quantity: v ?? 1 })} min={1} max={99} /></div>
        </>
      )}
      {a.type === "submitForm" && <p className="text-xs text-zinc-600">Saves what the visitor typed to <b>Dashboard → Form submissions</b>. Use with the “A form is submitted” event.</p>}
      {a.type === "resetForm" && <p className="text-xs text-zinc-600">Clears the form&apos;s fields.</p>}
      {a.type === "subscribe" && (
        <div>
          <span className={lbl}>Email field</span>
          {fields.length ? <select className={inputCls} value={a.field} onChange={(e) => set({ ...a, field: e.target.value })}>{fields.map((f) => <option key={f}>{f}</option>)}</select>
            : <input className={cn(inputCls, "font-mono")} value={a.field} onChange={(e) => set({ ...a, field: e.target.value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40) || "email" })} />}
        </div>
      )}
      {(a.type === "cancelOrder" || a.type === "setOrderStatus" || a.type === "deleteOrder") && <OrderRef a={a} set={set} fields={fields} />}
      {a.type === "setOrderStatus" && (
        <div>
          <span className={lbl}>New status</span>
          <select className={inputCls} value={a.status} onChange={(e) => set({ ...a, status: e.target.value as typeof a.status })}>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}</select>
        </div>
      )}
      {a.type === "deleteOrder" && <p className="text-[11px] text-zinc-500">Paid orders are never deleted (cancel them instead). Stock is returned.</p>}
    </div>
  );
}

function ActionPicker({ onPick }: { onPick: (a: WorkflowAction) => void }) {
  const [q, setQ] = useState("");
  const groups = [...new Set(ACTIONS.map((a) => a.group))];
  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase());
  return (
    <div className="flex flex-col gap-3">
      <div className="relative"><Search className="absolute left-2 top-1.5 h-4 w-4 text-zinc-400" /><input autoFocus className={cn(inputCls, "pl-8")} placeholder="Search actions…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {groups.map((g) => {
        const items = ACTIONS.filter((a) => a.group === g && (match(a.label) || match(g)));
        if (!items.length) return null;
        return (
          <div key={g}>
            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{g}{g.includes("staff") && <Lock className="h-3 w-3" />}</p>
            {items.map((a) => (
              <button key={a.type} onClick={() => onPick(a.make())} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100">
                <a.icon className="h-4 w-4 text-zinc-500" /> {a.label}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

type Editing = { kind: "trigger" } | { kind: "action"; id: string } | { kind: "add" } | null;
const TRIGGER_ICON = { click: MousePointerClick, submit: Send, pageLoad: FileText, scroll: MoveDown };

/** The Workflows page (Bubble's workflow tab): list of workflows + event → steps editor. */
export function WorkflowsView({ config, setWorkflows, selectedId, setSelectedId, products, links }: {
  config: SiteConfig;
  setWorkflows: (fn: (w: Workflow[]) => Workflow[], key?: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  products: StorefrontProduct[];
  links: LinkOption[];
}) {
  const workflows = config.workflows ?? [];
  const nodes = useMemo(() => indexNodes(config), [config]);
  const pages = useMemo(() => pageRefs(config), [config]);
  const [editing, setEditing] = useState<Editing>(null);
  const [filter, setFilter] = useState("");
  const wf = workflows.find((w) => w.id === selectedId) ?? null;

  const update = (next: Workflow, key?: string) => setWorkflows((list) => list.map((w) => (w.id === next.id ? next : w)), key);
  const fields = wf && wf.trigger.type === "submit" ? formFields(nodes.find((n) => n.id === (wf.trigger as { nodeId: string }).nodeId)?.node) : [];

  function create() {
    const w = newWorkflow({ type: "click", nodeId: "pick-element" }, `Workflow ${workflows.length + 1}`);
    setWorkflows((list) => [...list, w]);
    setSelectedId(w.id);
    setEditing({ kind: "trigger" });
  }

  const shown = workflows.filter((w) => !filter || `${w.name} ${triggerSummary(w.trigger, nodes, pages)}`.toLowerCase().includes(filter.toLowerCase()));
  const groups = new Map<string, Workflow[]>();
  for (const w of shown) {
    const t = w.trigger;
    const page = t.type === "click" || t.type === "submit" ? nodes.find((n) => n.id === t.nodeId)?.pageName ?? "Unassigned" : pages.find((p) => p.id === t.pageId)?.name ?? "Unassigned";
    groups.set(page, [...(groups.get(page) ?? []), w]);
  }

  const editingAction = editing?.kind === "action" ? wf?.actions.find((a) => a.id === editing.id) : undefined;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-200 p-3">
          <div className="relative flex-1"><Search className="absolute left-2 top-1.5 h-4 w-4 text-zinc-400" /><input className={cn(inputCls, "pl-8")} placeholder="Search workflows" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
          <button onClick={create} className="rounded-md bg-brand-600 p-1.5 text-white hover:bg-brand-700" title="New workflow"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {!workflows.length && <p className="p-3 text-sm text-zinc-500">No workflows yet. A workflow runs steps when something happens — e.g. “when Button is clicked → go to page”.</p>}
          {[...groups].map(([page, items]) => (
            <div key={page} className="mb-3">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{page}</p>
              {items.map((w) => {
                const Icon = TRIGGER_ICON[w.trigger.type];
                return (
                  <button key={w.id} onClick={() => { setSelectedId(w.id); setEditing(null); }} className={cn("flex w-full items-start gap-2 rounded-md px-2 py-2 text-left", w.id === selectedId ? "bg-brand-50 text-brand-800" : "hover:bg-zinc-100", w.disabled && "opacity-50")}>
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{w.name || "Untitled"}</span>
                      <span className="block truncate text-[11px] text-zinc-500">{triggerSummary(w.trigger, nodes, pages)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle,#d4d4d8_1px,transparent_1px)] bg-[length:18px_18px] p-8">
        {wf ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{wf.name || "Untitled workflow"}</h2>
              {wf.disabled && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-medium">Off</span>}
              <div className="ml-auto flex gap-1">
                <button onClick={() => { const copy = { ...structuredClone(wf), id: newNodeId("wf"), name: `${wf.name} copy`, actions: wf.actions.map((a) => ({ ...a, id: newNodeId("act") })) }; setWorkflows((l) => [...l, copy]); setSelectedId(copy.id); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-50"><Copy className="mr-1 inline h-3.5 w-3.5" />Duplicate</button>
                <button onClick={() => { if (!confirm(`Delete workflow “${wf.name}”?`)) return; setWorkflows((l) => l.filter((w) => w.id !== wf.id)); setSelectedId(null); setEditing(null); }} className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Delete</button>
              </div>
            </div>
            {/* Event → steps, Bubble style */}
            <div className="flex flex-wrap items-stretch gap-3">
              <button onClick={() => setEditing({ kind: "trigger" })} className={cn("flex w-56 flex-col gap-1 rounded-xl border-2 bg-white p-3 text-left shadow-sm transition hover:shadow-md", editing?.kind === "trigger" ? "border-orange-500" : "border-orange-300")}>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-600"><Zap className="h-3.5 w-3.5" /> Event</span>
                <span className="text-sm font-medium">{triggerSummary(wf.trigger, nodes, pages)}</span>
                {wf.when && <span className="text-[11px] text-zinc-500">Only when: {conditionSummary(wf.when, nodes)}</span>}
              </button>
              {wf.actions.map((a, i) => {
                const meta = ACTION_META[a.type];
                const broken = ("nodeId" in a && a.nodeId === "pick-element") || (a.type === "addToCart" && !a.productId);
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                    <div className={cn("group relative flex w-52 flex-col gap-1 rounded-xl border-2 bg-white p-3 text-left shadow-sm transition hover:shadow-md", editing?.kind === "action" && editing.id === a.id ? "border-brand-500" : "border-zinc-200")}>
                      <button onClick={() => setEditing({ kind: "action", id: a.id })} className="absolute inset-0" aria-label={`Edit step ${i + 1}`} />
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Step {i + 1} {meta.staff && <Lock className="h-3 w-3 text-amber-600" />} {broken && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm font-medium"><meta.icon className="h-4 w-4 shrink-0 text-zinc-500" />{actionSummary(a, nodes, products)}</span>
                      <span className="relative z-10 mt-1 hidden gap-1 group-hover:flex">
                        <button disabled={i === 0} onClick={() => { const acts = [...wf.actions]; [acts[i - 1], acts[i]] = [acts[i], acts[i - 1]]; update({ ...wf, actions: acts }); }} className="rounded border px-1.5 text-[11px] disabled:opacity-30">←</button>
                        <button disabled={i === wf.actions.length - 1} onClick={() => { const acts = [...wf.actions]; [acts[i + 1], acts[i]] = [acts[i], acts[i + 1]]; update({ ...wf, actions: acts }); }} className="rounded border px-1.5 text-[11px] disabled:opacity-30">→</button>
                        <button onClick={() => { update({ ...wf, actions: wf.actions.filter((x) => x.id !== a.id) }); setEditing(null); }} className="rounded border border-red-200 px-1.5 text-[11px] text-red-600">Delete</button>
                      </span>
                    </div>
                  </div>
                );
              })}
              {wf.actions.length < 20 && (
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  <button onClick={() => setEditing({ kind: "add" })} className="flex w-52 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-white/70 p-3 text-sm text-zinc-500 hover:border-brand-500 hover:text-brand-700">
                    <Plus className="h-4 w-4" /> Click here to add an action…
                  </button>
                </div>
              )}
            </div>
            <p className="max-w-xl text-xs text-zinc-500">Steps run in order. Workflows run on your live store (and in Preview) — not inside the editor canvas. Changes save with your design and go live when you publish.</p>
          </div>
        ) : (
          <div className="mx-auto mt-20 max-w-md text-center text-sm text-zinc-500">
            <Zap className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
            <p className="font-semibold text-zinc-700">Workflows</p>
            <p className="mt-1">Make things happen when visitors click, submit a form, load or scroll a page — go to a page, show a message, add to cart, or (for staff) update orders.</p>
            <button onClick={create} className="mt-4 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">New workflow</button>
          </div>
        )}
      </main>

      {wf && editing?.kind === "trigger" && (
        <FloatingPanel title="Event" subtitle={wf.name} onClose={() => setEditing(null)}>
          <TriggerEditor wf={wf} onChange={(w) => update(w, `wf:${wf.id}:trigger`)} nodes={nodes} pages={pages} />
        </FloatingPanel>
      )}
      {wf && editing?.kind === "add" && (
        <FloatingPanel title="Add an action" subtitle={wf.name} onClose={() => setEditing(null)} width={320}>
          <ActionPicker onPick={(a) => { update({ ...wf, actions: [...wf.actions, a] }); setEditing({ kind: "action", id: a.id }); }} />
        </FloatingPanel>
      )}
      {wf && editingAction && (
        <FloatingPanel title={ACTION_META[editingAction.type].label} subtitle={`Step ${wf.actions.indexOf(editingAction) + 1} · ${wf.name}`} onClose={() => setEditing(null)}>
          <ActionEditor a={editingAction} set={(a) => update({ ...wf, actions: wf.actions.map((x) => (x.id === a.id ? a : x)) }, `wf:${wf.id}:${a.id}`)} nodes={nodes} links={links} products={products} fields={fields} />
        </FloatingPanel>
      )}
    </div>
  );
}
