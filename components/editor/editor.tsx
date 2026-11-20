"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowLeft, Check, CloudOff, Eye, Loader2, Monitor, Palette, Plus, Redo2, Smartphone, Tablet, Undo2, Layers, FileText, LayoutTemplate, Bookmark, Trash2, Paintbrush, Zap, ShoppingBag } from "lucide-react";
import { z } from "zod";
import { PARENT_TYPES, SYSTEM_PAGES, nodeSchema, sectionSchema, siteConfigSchema, type Conditional, type SystemPageKind, type Workflow, type Device, type LayoutNode, type ResponsiveStyle, type SavedTemplateItem, type Section, type SettingValue, type SiteConfig, type SitePage, type Style, type Theme } from "@/lib/editor/schema";
import { SECTION_MAP, createSection, defaultSystemSections, newSectionId } from "@/lib/editor/sections";
import {
  CONTAINER_PRESETS, cloneNode, cloneSection, createColumns, createCustomSection, createForm, createNode, duplicateNode, findNode, insertNode, insertRelative, insideForm,
  moveNode, nodePath, removeNode, setStyleValue, shiftNode, updateNode, compactForBar, starterBar, createProductGrid, productGridToCustom, groupNodes, ungroupNode, moveToEdge, effectiveStyle, findParent, type DropPosition,
} from "@/lib/editor/nodes";
import type { StorefrontCtx } from "@/components/storefront/types";
import { themeVars } from "@/components/storefront/theme";
import { Button, cn } from "@/components/ui";
import { slugify } from "@/lib/slug";
import { useHistory } from "./use-history";
import { ComponentLibrary, type ElementSpec } from "./library";
import { Canvas, type Selection } from "./canvas";
import { PageProperties, ThemeProperties, type LinkOption } from "./properties";
import { MultiProperties, NodeProperties, SectionTabs, elementLabel, type ArrangeAction, type StyleSetter } from "./style-panel";
import { Navigator } from "./navigator";
import { WorkflowsView } from "./workflows";
import { ElementLogicDialog } from "./logic";
import { FontLoader } from "./font-loader";
import { FONTS } from "@/lib/editor/fonts";
import { twInDesign } from "@/lib/editor/tailwind";
import type { CanvasNodeApi, DropHint, NodeTarget } from "./node-chrome";
import { deleteTemplateAction, tailwindCssAction, discardDraftAction, publishAction, saveDraftAction, saveTemplateAction } from "@/app/store-builder/actions";

type SaveState = "saved" | "dirty" | "saving" | "error";

type Props = {
  initialConfig: SiteConfig;
  ctx: StorefrontCtx;
  /** Where the draft preview lives: "" on the store's own domain, "/s/<slug>" otherwise. */
  previewBase: string;
  status: "DRAFT" | "PUBLISHED" | "SUSPENDED";
  canPublish: boolean;
  hasPublished: boolean;
  publishedDiffers: boolean;
  liveUrl: string;
  initialSaved: SavedTemplateItem[];
};

type SectionTarget = "header" | "footer" | string;

/** Copied elements or a copied section (see copySelection / pasteClip). */
type Clip = { kind: "nodes"; nodes: LayoutNode[] } | { kind: "section"; section: Section };
const CLIP_KEY = "sh_editor_clipboard";

function loadClip(): Clip | null {
  try {
    const raw = JSON.parse(localStorage.getItem(CLIP_KEY) ?? "null");
    const nodes = z.array(nodeSchema).max(60).safeParse(raw?.nodes);
    if (raw?.kind === "nodes" && nodes.success && nodes.data.length) return { kind: "nodes", nodes: nodes.data };
    const sec = sectionSchema.safeParse(raw?.section);
    if (raw?.kind === "section" && sec.success) return { kind: "section", section: sec.data };
  } catch { /* storage blocked or bad data */ }
  return null;
}

/** First content of a custom information bar: a centred row with a message and a button. */
function starterTopBar(): LayoutNode {
  return createNode("container", {
    props: { contentWidth: "boxed" },
    style: {
      desktop: { direction: "row", justify: "center", align: "center", gap: 16, padding: { t: 8, r: 16, b: 8, l: 16, u: "px" }, bg: "primary", color: "white" },
      mobile: { direction: "column", gap: 8 },
    },
    children: [
      createNode("text", { props: { text: "New collection out now — free delivery in Kigali" }, style: { desktop: { fontSize: 14, fontWeight: "500" } } }),
      createNode("button", { props: { text: "Shop now", link: "/products", variant: "light", size: "sm" } }),
    ],
  });
}

/** The header holds three element trees, addressed by these slot names. */
const HEADER_SLOTS = { header: "nodes", "header-nav": "navNodes", "header-bar": "barNodes" } as const;
type HeaderSlot = keyof typeof HEADER_SLOTS;
const SLOT_LABEL: Record<HeaderSlot, string> = { header: "Information bar", "header-nav": "Navigation bar", "header-bar": "Custom navigation bar" };

/** First content of the navigation bar's own elements: a row with one button. */
function starterNav(): LayoutNode {
  return createNode("container", {
    style: { desktop: { direction: "row", align: "center", gap: 12, padding: { t: 0, r: 0, b: 0, l: 0, u: "px" } } },
    children: [createNode("button", { props: { text: "Contact us", link: "/contact", variant: "solid", size: "sm" } })],
  });
}

/** Built-in shop pages are edited as pseudo pages with ids like "sys:shop". */
const sysKind = (pageId: string) => (pageId.startsWith("sys:") ? (pageId.slice(4) as SystemPageKind) : null);

function getPage(config: SiteConfig, pageId: string): SitePage {
  const kind = sysKind(pageId);
  if (kind) {
    const meta = SYSTEM_PAGES.find((p) => p.kind === kind)!;
    return { id: pageId, name: meta.name, slug: meta.slug, sections: config.systemPages?.[kind] ?? defaultSystemSections(kind) };
  }
  return config.pages.find((p) => p.id === pageId) ?? config.pages[0];
}

function updatePage(config: SiteConfig, pageId: string, fn: (p: SitePage) => SitePage): SiteConfig {
  const kind = sysKind(pageId);
  if (kind) return { ...config, systemPages: { ...config.systemPages, [kind]: fn(getPage(config, pageId)).sections } };
  return { ...config, pages: config.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

/** Where a drop lands relative to a hovered element. */
function dropPosition(rect: { left: number; top: number; width: number; height: number }, p: { x: number; y: number }, isContainer: boolean, axis: "x" | "y"): DropPosition {
  if (isContainer) {
    const ex = Math.min(14, rect.width * 0.2), ey = Math.min(14, rect.height * 0.2);
    if (p.x > rect.left + ex && p.x < rect.left + rect.width - ex && p.y > rect.top + ey && p.y < rect.top + rect.height - ey) return "inside";
  }
  const along = axis === "x" ? (p.x - rect.left) / rect.width : (p.y - rect.top) / rect.height;
  return along < 0.5 ? "before" : "after";
}

/** Elements & nodes: deepest element under the pointer, else nearest section. Sections: nearest section. */
const collision: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind;
  const notNodes = args.droppableContainers.filter((c) => !String(c.id).startsWith("drop:"));
  if (kind === "element" || kind === "node") {
    const hits = pointerWithin(args);
    const self = `drop:${args.active.data.current?.nodeId}`;
    const nodeHits = hits.filter((h) => String(h.id).startsWith("drop:") && h.id !== self);
    if (nodeHits.length) {
      const area = (id: string | number) => { const r = args.droppableRects.get(id); return r ? r.width * r.height : Infinity; };
      return [nodeHits.reduce((a, b) => (area(b.id) < area(a.id) ? b : a))];
    }
    const sectionHits = hits.filter((h) => !String(h.id).startsWith("drop:"));
    if (sectionHits.length) return sectionHits;
  }
  return closestCenter({ ...args, droppableContainers: notNodes });
};

export function Editor({ initialConfig, ctx: baseCtx, previewBase, status, canPublish, hasPublished, publishedDiffers, liveUrl, initialSaved }: Props) {
  const history = useHistory<SiteConfig>(initialConfig);
  const config = history.value;
  const [pageId, setPageId] = useState(config.pages[0].id);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [leftTab, setLeftTab] = useState<"add" | "layers">("add");
  const [save, setSave] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unpublished, setUnpublished] = useState(publishedDiffers || status !== "PUBLISHED");
  const [isLive, setIsLive] = useState(status === "PUBLISHED");
  const [publishing, startPublish] = useTransition();
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [hint, setHint] = useState<DropHint>(null);
  const hintRef = useRef<DropHint>(null);
  const [saved, setSaved] = useState<SavedTemplateItem[]>(initialSaved);
  const [pageMenu, setPageMenu] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"design" | "workflows">("design");
  const [logicFor, setLogicFor] = useState<NodeTarget | null>(null);
  const [previewCond, setPreviewCond] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  /** Extra elements picked with shift-click (same section as the selected element). */
  const [multi, setMulti] = useState<string[]>([]);
  const [clip, setClip] = useState<Clip | null>(null);
  // Custom Tailwind classes: compiled on the server (debounced) for the canvas.
  const twKey = useMemo(() => twInDesign(config).join(" "), [config]);
  const [twCss, setTwCss] = useState("");
  useEffect(() => {
    if (!twKey) { setTwCss(""); return; }
    let live = true;
    const t = setTimeout(() => {
      tailwindCssAction(twKey.split(" ")).then((r) => { if (live) setTwCss(r.css); }).catch(() => { /* stale editor: keep the last CSS */ });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [twKey]);
  // Something copied earlier (another page, tab or visit) can still be pasted.
  useEffect(() => { setClip(loadClip()); }, []);
  const firstRender = useRef(true);
  const saveSeq = useRef(0);

  const page = getPage(config, pageId);
  const isSystemPage = !!sysKind(pageId);
  const ctx: StorefrontCtx = useMemo(() => ({ ...baseCtx, theme: config.theme, editing: true }), [baseCtx, config.theme]);
  const tv = useMemo(() => themeVars(config.theme), [config.theme]);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 3500); };

  // ─── Autosave (debounced) ────────────────────────────────────────────────
  // Unsaved changes are also kept on this device, so nothing is lost when a
  // save can't reach the server — e.g. after the app was updated while this
  // tab was open (its old save function no longer exists on the server).
  const backupKey = `sh_editor_backup_${baseCtx.store.id}`;
  const [staleApp, setStaleApp] = useState(false);
  const [backup, setBackup] = useState<{ savedAt: number; config: SiteConfig } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt: number; config: unknown };
      const cfg = siteConfigSchema.safeParse(parsed.config);
      if (cfg.success && JSON.stringify(cfg.data) !== JSON.stringify(initialConfig)) setBackup({ savedAt: parsed.savedAt, config: cfg.data });
      else localStorage.removeItem(backupKey);
    } catch { /* storage unavailable */ }
  }, [backupKey]); // eslint-disable-line react-hooks/exhaustive-deps -- once on load

  const persist = useCallback(async (value: SiteConfig) => {
    const seq = ++saveSeq.current;
    setSave("saving");
    let thrown = false;
    const res = await saveDraftAction(value).catch(() => { thrown = true; return { error: "Couldn't reach the server — changes not saved yet" }; });
    if (seq !== saveSeq.current) return; // a newer save superseded this one
    if ("error" in res && res.error) {
      setSave("error");
      setSaveError(res.error);
      setStaleApp(thrown);
    } else {
      setSave("saved");
      setSaveError(null);
      setStaleApp(false);
      try { localStorage.removeItem(backupKey); } catch { /* ignore */ }
    }
  }, [backupKey]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSave("dirty");
    setUnpublished(true);
    try { localStorage.setItem(backupKey, JSON.stringify({ savedAt: Date.now(), config })); } catch { /* full or blocked */ }
    const t = setTimeout(() => persist(config), 1200);
    return () => clearTimeout(t);
  }, [config, persist, backupKey]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (save === "dirty" || save === "saving") e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  // ─── Section operations ─────────────────────────────────────────────────
  const commitPage = (fn: (sections: Section[]) => Section[], key: string | null = null) =>
    history.commit((c) => updatePage(c, pageId, (p) => ({ ...p, sections: fn(p.sections) })), key);

  /** Update the header, footer or a page section by id. */
  function updateSection(target: SectionTarget, fn: (s: Section) => Section, key: string | null = null) {
    if (target === "header" || target === "footer") history.commit((c) => ({ ...c, [target]: fn(c[target]) }), key);
    else commitPage((secs) => secs.map((s) => (s.id === target ? fn(s) : s)), key);
  }

  function addSection(type: string, index?: number) {
    const s = type === "custom" ? createCustomSection(newSectionId("custom"), [createColumns([1])]) : createSection(type);
    insertSection(s, index);
  }
  function insertSection(s: Section, index?: number) {
    commitPage((secs) => {
      const selId = selection?.kind === "section" ? selection.id : selection?.kind === "node" ? selection.sectionId : null;
      const selIdx = selId ? secs.findIndex((x) => x.id === selId) : -1;
      const at = index ?? (selIdx >= 0 ? selIdx + 1 : secs.length);
      return [...secs.slice(0, at), s, ...secs.slice(at)];
    });
    setSelection({ kind: "section", id: s.id });
    scrollTo(`[data-section-id="${s.id}"]`);
  }
  function scrollTo(selector: string) {
    setTimeout(() => document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }
  function removeSection(id: string) {
    const sec = page.sections.find((s) => s.id === id);
    if (sec && SECTION_MAP[sec.type]?.system) return flash("This block holds the page's own content — move it, but it can't be removed.");
    commitPage((secs) => secs.filter((s) => s.id !== id));
    setSelection(null);
  }

  function setSettingFor(target: SectionTarget, key: string, value: SettingValue) {
    updateSection(target, (s) => {
      const next = { ...s, settings: { ...s.settings, [key]: value } };
      // Switching the header's information bar to a custom layout starts it with an editable row.
      if (target === "header" && key === "topBarMode" && value === "custom" && !s.nodes?.length) next.nodes = [starterTopBar()];
      // Turning on "your own elements" gives the navigation bar a row container to drop into.
      if (target === "header" && key === "navElements" && value === true && !s.navNodes?.length) next.navNodes = [starterNav()];
      // Going fully custom starts from an editable copy of the standard bar.
      if (target === "header" && key === "navMode" && value === "custom" && !s.barNodes?.length) next.barNodes = [starterBar(s)];
      return next;
    }, `${target}:${key}`);
  }

  /** Header/footer elements are addressed by the target name, page sections by id. */
  const isHeaderSlot = (id: string): id is HeaderSlot => id in HEADER_SLOTS;
  const findSection = (id: string): Section | undefined => (isHeaderSlot(id) ? config.header : id === "footer" ? config.footer : page.sections.find((s) => s.id === id));
  const getNodes = (id: string): LayoutNode[] => (isHeaderSlot(id) ? config.header[HEADER_SLOTS[id]] ?? [] : findSection(id)?.nodes ?? []);
  const sectionSelection = (id: string): Selection => (isHeaderSlot(id) ? { kind: "header" } : id === "footer" ? { kind: "footer" } : { kind: "section", id });
  const selectedTarget: SectionTarget | null =
    selection?.kind === "header" || selection?.kind === "footer" ? selection.kind : selection?.kind === "section" ? selection.id : null;

  const sectionStyleSetter = (target: SectionTarget): StyleSetter => (key, value, d = device) =>
    updateSection(target, (s) => ({ ...s, style: setStyleValue(s.style, d, key, value) }), `sstyle:${target}:${String(key)}:${d}`);

  // ─── Node (custom layout) operations ────────────────────────────────────
  const updateNodes = (sectionId: string, fn: (nodes: LayoutNode[]) => LayoutNode[], key: string | null = null) =>
    isHeaderSlot(sectionId)
      ? updateSection("header", (s) => ({ ...s, [HEADER_SLOTS[sectionId]]: fn(s[HEADER_SLOTS[sectionId]] ?? []) }), key)
      : updateSection(sectionId, (s) => ({ ...s, nodes: fn(s.nodes ?? []) }), key);

  const setNodeProp = (t: NodeTarget, k: string, v: string | number | boolean) =>
    updateNodes(t.sectionId, (ns) => updateNode(ns, t.nodeId, (n) => ({ ...n, props: { ...n.props, [k]: v } })), `node:${t.nodeId}:${k}`);

  const setNodeStyleOn = (t: NodeTarget, fn: (rs: ResponsiveStyle | undefined) => ResponsiveStyle | undefined, key: string) =>
    updateNodes(t.sectionId, (ns) => updateNode(ns, t.nodeId, (n) => ({ ...n, style: fn(n.style) })), key);

  const nodeStyleSetter = (t: NodeTarget): StyleSetter => (key, value, d = device) =>
    setNodeStyleOn(t, (rs) => setStyleValue(rs, d, key, value), `nstyle:${t.nodeId}:${String(key)}:${d}`);

  function deleteSelected() {
    if (selection?.kind !== "node") return;
    const sid = selection.sectionId;
    const ids = [selection.nodeId, ...multi];
    updateNodes(sid, (ns) => ids.reduce((acc, id) => removeNode(acc, id), ns));
    setMulti([]);
    setSelection(sectionSelection(sid));
  }

  function removeNodeAt(t: NodeTarget) {
    updateNodes(t.sectionId, (ns) => removeNode(ns, t.nodeId));
    setSelection(sectionSelection(t.sectionId));
  }
  function duplicateNodeAt(t: NodeTarget) {
    let copy: string | null = null;
    updateNodes(t.sectionId, (ns) => { const r = duplicateNode(ns, t.nodeId); copy = r.copyId; return r.nodes; });
    setTimeout(() => copy && setSelection({ kind: "node", sectionId: t.sectionId, nodeId: copy }), 0);
  }
  /** Select a node; `parent` climbs to its container; `additive` (shift-click) builds a multi-selection. */
  function selectNode(t: NodeTarget, parent = false, additive = false) {
    if (additive && selection?.kind === "node" && selection.sectionId === t.sectionId) {
      const all = new Set([selection.nodeId, ...multi]);
      if (all.has(t.nodeId)) all.delete(t.nodeId); else all.add(t.nodeId);
      const ids = [...all];
      if (!ids.length) { setMulti([]); return setSelection(sectionSelection(t.sectionId)); }
      const primary = ids.includes(t.nodeId) ? t.nodeId : ids[ids.length - 1];
      setSelection({ kind: "node", sectionId: t.sectionId, nodeId: primary });
      setMulti(ids.filter((id) => id !== primary));
      return;
    }
    setMulti([]);
    if (!parent) return setSelection({ kind: "node", ...t });
    const up = nodePath(getNodes(t.sectionId), t.nodeId)?.at(-1);
    setSelection(up ? { kind: "node", sectionId: t.sectionId, nodeId: up.id } : sectionSelection(t.sectionId));
  }

  /** Wrap the selected element(s) in a new row/column container. */
  function groupSelected(direction: "row" | "column") {
    if (selection?.kind !== "node") return;
    const sid = selection.sectionId;
    const ids = [selection.nodeId, ...multi];
    const res = groupNodes(getNodes(sid), ids, direction);
    if (!res) return flash("To group, pick elements that sit in the same container.");
    updateNodes(sid, () => res.nodes);
    setMulti([]);
    setSelection({ kind: "node", sectionId: sid, nodeId: res.groupId });
  }

  function arrange(t: NodeTarget, a: ArrangeAction) {
    if (a === "wrapRow" || a === "wrapColumn") return groupSelected(a === "wrapRow" ? "row" : "column");
    if (a === "ungroup") {
      const first = findNode(getNodes(t.sectionId), t.nodeId)?.children?.[0];
      updateNodes(t.sectionId, (ns) => ungroupNode(ns, t.nodeId));
      setSelection(first ? { kind: "node", sectionId: t.sectionId, nodeId: first.id } : sectionSelection(t.sectionId));
      return;
    }
    updateNodes(t.sectionId, (ns) => (a === "first" || a === "last" ? moveToEdge(ns, t.nodeId, a === "first" ? "start" : "end") : shiftNode(ns, t.nodeId, a === "earlier" ? -1 : 1)));
  }

  /** Flow direction of the container holding a node, on the current device. */
  function parentDirection(sid: string, trail: LayoutNode[]): string {
    const parent = trail.at(-1);
    if (parent) return effectiveStyle(parent.style, device).direction ?? "column";
    if (sid === "header-nav") return "row";
    if (isHeaderSlot(sid)) return "column";
    return effectiveStyle(findSection(sid)?.style, device).direction ?? "column";
  }

  const hasForm = (n: LayoutNode): boolean => n.type === "form" || !!n.children?.some(hasForm);
  /** Forms can't contain forms (invalid HTML); refuse such drops with a hint. */
  function wouldNestForm(dest: { sectionId: string; nodeId: string | null; pos: DropPosition }, node: LayoutNode) {
    if (!dest.nodeId || !hasForm(node)) return false;
    const nodes = getNodes(dest.sectionId);
    const target = findNode(nodes, dest.nodeId);
    const nested = insideForm(nodes, dest.nodeId) || (target?.type === "form" && dest.pos === "inside");
    if (nested) flash("A form can't go inside another form.");
    return nested;
  }

  /** Dropping "inside" a product grid means into its card design. */
  function intoCard<T extends { sectionId: string; nodeId: string | null; pos: DropPosition }>(d: T): T {
    if (!d.nodeId || d.pos !== "inside") return d;
    const t = findNode(getNodes(d.sectionId), d.nodeId);
    const card = t?.type === "products" ? t.children?.[0] : undefined;
    return card && PARENT_TYPES.has(card.type) ? { ...d, nodeId: card.id } : d;
  }

  /** Move a node anywhere on the page, including into another custom section. */
  function moveNodeTo(from: NodeTarget, rawTo: { sectionId: string; nodeId: string | null; pos: DropPosition }) {
    const to = intoCard(rawTo);
    const moving = findNode(getNodes(from.sectionId), from.nodeId);
    if (moving && wouldNestForm(to, moving)) return;
    // The header is shared by every page, so its elements stay in it — but
    // they can move between the information bar and the navigation bar.
    if (isHeaderSlot(from.sectionId) || isHeaderSlot(to.sectionId)) {
      if (!isHeaderSlot(from.sectionId) || !isHeaderSlot(to.sectionId)) return flash("Elements can't move between the header and the page — copy them instead.");
      if (!moving) return;
      if (to.nodeId && (to.nodeId === moving.id || findNode(moving.children ?? [], to.nodeId))) return;
      const key = (id: string) => HEADER_SLOTS[id as HeaderSlot];
      updateSection("header", (s) => {
        const next = { ...s, [key(from.sectionId)]: removeNode(s[key(from.sectionId)] ?? [], from.nodeId) };
        const dest = next[key(to.sectionId)] ?? [];
        next[key(to.sectionId)] = to.nodeId ? insertRelative(dest, to.nodeId, moving, to.pos) : insertNode(dest, null, moving);
        return next;
      });
      setSelection({ kind: "node", sectionId: to.sectionId, nodeId: from.nodeId });
      return;
    }
    commitPage((secs) => {
      const src = secs.find((s) => s.id === from.sectionId);
      const node = src?.nodes ? findNode(src.nodes, from.nodeId) : null;
      if (!node) return secs;
      if (from.sectionId === to.sectionId && to.nodeId) {
        return secs.map((s) => (s.id === to.sectionId ? { ...s, nodes: moveNode(s.nodes ?? [], from.nodeId, to.nodeId!, to.pos) } : s));
      }
      if (to.nodeId && (to.nodeId === node.id || findNode(node.children ?? [], to.nodeId))) return secs;
      return secs.map((s) => {
        let nodes = s.nodes ?? [];
        if (s.id === from.sectionId) nodes = removeNode(nodes, from.nodeId);
        if (s.id === to.sectionId) nodes = to.nodeId ? insertRelative(nodes, to.nodeId, node, to.pos) : insertNode(nodes, null, node);
        return nodes === (s.nodes ?? []) ? s : { ...s, nodes };
      });
    });
    setSelection({ kind: "node", sectionId: to.sectionId, nodeId: from.nodeId });
  }

  // ─── Workflows & conditions ─────────────────────────────────────────────
  const setWorkflows = (fn: (w: Workflow[]) => Workflow[], key?: string) => history.commit((c) => ({ ...c, workflows: fn(c.workflows ?? []) }), key ?? null);
  const setConditions = (t: NodeTarget) => (fn: (c: Conditional[]) => Conditional[], key?: string) =>
    updateNodes(t.sectionId, (ns) => updateNode(ns, t.nodeId, (n) => { const next = fn(n.conditions ?? []); return { ...n, conditions: next.length ? next : undefined }; }), key ?? null);
  function openWorkflow(id: string) {
    setWorkflowId(id);
    setLogicFor(null);
    setPreviewCond(null);
    setMode("workflows");
  }

  // ─── Inserting elements ─────────────────────────────────────────────────
  const savedById = (id: string) => saved.find((s) => s.id === id);

  function nodeFromSpec(spec: ElementSpec): LayoutNode | null {
    if ("element" in spec) return spec.element === "form" ? createForm() : spec.element === "products" ? createProductGrid(spec.props) : createNode(spec.element, { props: spec.props ?? {} });
    if ("preset" in spec) { const p = CONTAINER_PRESETS.find((x) => x.key === spec.preset); return p ? createColumns(p.columns) : null; }
    const item = savedById(spec.saved);
    return item?.kind === "BLOCK" && "node" in item.data ? cloneNode(item.data.node) : null;
  }
  function sectionFromSpec(spec: ElementSpec): Section | null {
    if ("saved" in spec) {
      const item = savedById(spec.saved);
      if (item?.kind === "BLOCK" && "section" in item.data) return cloneSection(item.data.section, newSectionId(item.data.section.type));
    }
    const node = nodeFromSpec(spec);
    if (!node) return null;
    // Loose elements get a boxed container so they line up with the rest of the page.
    const root = node.type === "container" ? node : createNode("container", { props: { contentWidth: "boxed" }, children: [node] });
    return createCustomSection(newSectionId("custom"), [root]);
  }

  /** Where new elements go when the header itself is selected (null: it has no element tree). */
  function headerTarget(): { sectionId: HeaderSlot; nodeId: string | null; pos: DropPosition } | null {
    const st = config.header.settings;
    // A fully custom bar, or the bar's own elements: add into its main container.
    if (st.navMode === "custom") return { sectionId: "header-bar", nodeId: (config.header.barNodes ?? []).find((n) => PARENT_TYPES.has(n.type))?.id ?? null, pos: "inside" };
    if (st.navElements === true) return { sectionId: "header-nav", nodeId: (config.header.navNodes ?? []).find((n) => PARENT_TYPES.has(n.type))?.id ?? null, pos: "inside" };
    if (st.topBar === true && st.topBarMode === "custom") return { sectionId: "header", nodeId: null, pos: "inside" };
    return null;
  }

  /** Product grid section → custom layout with an editable card design. */
  function customiseGrid(id: string) {
    const src = page.sections.find((x) => x.id === id);
    if (!src) return;
    const next = productGridToCustom(src, newSectionId("custom"));
    commitPage((secs) => secs.map((x) => (x.id === id ? next : x)));
    const grid = next.nodes?.[0]?.children?.find((n) => n.type === "products");
    const card = grid?.children?.[0];
    setSelection(card ? { kind: "node", sectionId: next.id, nodeId: card.id } : { kind: "section", id: next.id });
    flash("Done — the first card is the design for every product. Click inside it to edit; Undo (⌘Z) switches back.");
  }

  // ─── Copy & paste ───────────────────────────────────────────────────────
  /** Copied elements (kept in this browser so they paste on other pages and after a reload). */
  const readClip = (): Clip | null => clip ?? loadClip();
  function writeClip(c: Clip) {
    setClip(c);
    try { localStorage.setItem(CLIP_KEY, JSON.stringify(c)); } catch { /* storage full or blocked */ }
  }

  /** Copies the selected element(s) — in page order, without nesting duplicates — or the selected section. */
  function copySelection(cut = false): boolean {
    if (selection?.kind === "node") {
      const ids = new Set([selection.nodeId, ...multi]);
      const picked: LayoutNode[] = [];
      const walk = (list: LayoutNode[]) => { for (const n of list) { if (ids.has(n.id)) picked.push(n); else if (n.children) walk(n.children); } };
      walk(getNodes(selection.sectionId));
      if (!picked.length) return false;
      writeClip({ kind: "nodes", nodes: structuredClone(picked) });
      const what = picked.length === 1 ? elementLabel(picked[0].type) : `${picked.length} elements`;
      if (cut) deleteSelected();
      flash(`${cut ? "Cut" : "Copied"} ${what} — select a container (or any element) and press ⌘V to paste.`);
      return true;
    }
    if (selection?.kind === "section") {
      const sec = page.sections.find((x) => x.id === selection.id);
      if (!sec) return false;
      if (SECTION_MAP[sec.type]?.system) { flash("This block holds the page's own content and can't be copied."); return true; }
      writeClip({ kind: "section", section: structuredClone(sec) });
      if (cut) removeSection(sec.id);
      flash(`${cut ? "Cut" : "Copied"} section — select a section and press ⌘V to paste it below.`);
      return true;
    }
    return false;
  }

  /**
   * Pastes into the selected container (or a product grid's card), after the
   * selected element, into a selected custom section or header bar — or, with
   * anything else selected, as a new section below it.
   */
  function pasteClip(): boolean {
    const c = readClip();
    if (!c) return false;
    if (c.kind === "section") {
      insertSection(cloneSection(c.section, newSectionId(c.section.type)));
      return true;
    }
    const fresh = c.nodes.map(cloneNode);
    let dest: { sectionId: string; nodeId: string | null; pos: DropPosition } | null = null;
    const sel = selection;
    if (sel?.kind === "node") {
      const target = findNode(getNodes(sel.sectionId), sel.nodeId);
      dest = intoCard({ sectionId: sel.sectionId, nodeId: sel.nodeId, pos: target && PARENT_TYPES.has(target.type) ? "inside" : "after" });
    } else if (sel?.kind === "section" && page.sections.find((x) => x.id === sel.id)?.type === "custom") {
      dest = { sectionId: sel.id, nodeId: null, pos: "inside" };
    } else if (sel?.kind === "header") {
      dest = headerTarget();
    }
    if (!dest) {
      const root = fresh.length === 1 && fresh[0].type === "container" ? fresh[0] : createNode("container", { props: { contentWidth: "boxed" }, children: fresh });
      insertSection(createCustomSection(newSectionId("custom"), [root]));
      return true;
    }
    const d = dest;
    if (fresh.some((n) => wouldNestForm(d, n))) return true;
    updateNodes(d.sectionId, (ns) => {
      if (!d.nodeId) return fresh.reduce((acc, n) => insertNode(acc, null, n), ns);
      if (d.pos === "inside") return fresh.reduce((acc, n) => insertNode(acc, d.nodeId, n), ns);
      // "after": insert in reverse so they keep their order.
      return [...fresh].reverse().reduce((acc, n) => insertRelative(acc, d.nodeId!, n, "after"), ns);
    });
    setSelection({ kind: "node", sectionId: d.sectionId, nodeId: fresh[0].id });
    setMulti(fresh.slice(1).map((n) => n.id));
    scrollTo(`[data-node-id="${fresh[0].id}"]`);
    return true;
  }

  /** Insert at a drop target, or (no target) next to the current selection. */
  function insertSpec(spec: ElementSpec, at?: { sectionId: string; nodeId: string | null; pos: DropPosition } | { sectionIndex: number }) {
    const asSection = "saved" in spec && savedById(spec.saved)?.data && "section" in (savedById(spec.saved)!.data);
    if (!at) {
      const sel = selection;
      if (!asSection && sel?.kind === "node") {
        const target = findNode(getNodes(sel.sectionId), sel.nodeId);
        at = { sectionId: sel.sectionId, nodeId: sel.nodeId, pos: target && PARENT_TYPES.has(target.type) ? "inside" : "after" };
      } else if (!asSection && sel?.kind === "section" && page.sections.find((s) => s.id === sel.id)?.type === "custom") {
        at = { sectionId: sel.id, nodeId: null, pos: "inside" };
      } else if (!asSection && sel?.kind === "header") {
        at = headerTarget() ?? undefined;
      }
    }
    if (at && "sectionId" in at && !asSection) {
      const made = nodeFromSpec(spec);
      if (!made) return;
      const node = isHeaderSlot(at.sectionId) && !("saved" in spec) ? compactForBar(made) : made;
      const dest = intoCard(at);
      if (wouldNestForm(dest, node)) return;
      updateNodes(dest.sectionId, (ns) => (dest.nodeId ? insertRelative(ns, dest.nodeId, node, dest.pos) : insertNode(ns, null, node)));
      setSelection({ kind: "node", sectionId: dest.sectionId, nodeId: node.id });
      scrollTo(`[data-node-id="${node.id}"]`);
      return;
    }
    const s = sectionFromSpec(spec);
    if (!s) return;
    const index = at && "sectionIndex" in at ? at.sectionIndex : at && "sectionId" in at && at.sectionId !== "header" ? page.sections.findIndex((x) => x.id === at.sectionId) + 1 : undefined;
    insertSection(s, index);
  }

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) history.redo(); else history.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); history.redo(); return; }
      // Leave normal text copy alone when text on the page is highlighted.
      const textSelected = !!window.getSelection()?.toString();
      if (mod && !e.shiftKey && (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "x") && !textSelected) { if (copySelection(e.key.toLowerCase() === "x")) e.preventDefault(); return; }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "v") { if (pasteClip()) e.preventDefault(); return; }
      if (selection?.kind === "node") {
        const t = { sectionId: selection.sectionId, nodeId: selection.nodeId };
        if (mod && e.key.toLowerCase() === "g") { e.preventDefault(); groupSelected(e.shiftKey ? "column" : "row"); return; }
        if ((e.key === "Delete" || e.key === "Backspace") && multi.length) { e.preventDefault(); deleteSelected(); return; }
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeNodeAt(t); }
        else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateNodeAt(t); }
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); updateNodes(t.sectionId, (ns) => shiftNode(ns, t.nodeId, e.key === "ArrowUp" ? -1 : 1)); }
        else if (e.key === "Escape") selectNode(t, true);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection?.kind === "section") { e.preventDefault(); removeSection(selection.id); }
      if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const actions = {
    onSelect: (id: string) => setSelection({ kind: "section", id }),
    onMove: (id: string, dir: -1 | 1) => commitPage((secs) => { const i = secs.findIndex((s) => s.id === id); const j = i + dir; return j < 0 || j >= secs.length ? secs : arrayMove(secs, i, j); }),
    onDuplicate: (id: string) => {
      const src = page.sections.find((s) => s.id === id);
      if (!src) return;
      const copy = cloneSection(src, newSectionId(src.type));
      commitPage((secs) => { const i = secs.findIndex((s) => s.id === id); return [...secs.slice(0, i + 1), copy, ...secs.slice(i + 1)]; });
      setSelection({ kind: "section", id: copy.id });
    },
    onToggle: (id: string) => commitPage((secs) => secs.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s))),
    onDelete: removeSection,
    onSetting: (target: string, key: string, value: SettingValue) => setSettingFor(target, key, value),
    onNodeProp: (sectionId: string, nodeId: string, key: string, value: string | number | boolean) => setNodeProp({ sectionId, nodeId }, key, value),
    onSaveBlock: (id: string) => { const s = page.sections.find((x) => x.id === id); if (s) saveTemplate("BLOCK", { section: s }, SECTION_MAP[s.type]?.label ?? "Section"); },
  };

  const nodeApi: Omit<CanvasNodeApi, "zoom" | "device"> = {
    selected: selection?.kind === "node" ? { sectionId: selection.sectionId, nodeId: selection.nodeId } : null,
    hint,
    multi,
    select: selectNode,
    setStyle: (t, key, value) => nodeStyleSetter(t)(key, value),
    patchStyle: (t, patch) => setNodeStyleOn(t, (rs) => {
      let next = rs;
      for (const [k, v] of Object.entries(patch)) next = setStyleValue(next, device, k as keyof Style, v as never);
      return next;
    }, `npatch:${t.nodeId}:${Object.keys(patch).join(",")}:${device}`),
    duplicate: duplicateNodeAt,
    remove: removeNodeAt,
    openLogic: (t) => { setSelection({ kind: "node", ...t }); setLogicFor(t); },
  };

  // ─── Saved blocks & page templates ──────────────────────────────────────
  async function saveTemplate(kind: "BLOCK" | "PAGE", data: unknown, suggested: string) {
    const name = prompt(kind === "PAGE" ? "Name this page template" : "Name this block (it appears under Saved blocks)", suggested);
    if (!name?.trim()) return;
    const res = await saveTemplateAction({ kind, name, data }).catch(() => ({ error: "Network error — not saved" }));
    if ("item" in res && res.item) { setSaved((s) => [res.item!, ...s]); flash(`Saved “${res.item.name}”`); }
    else flash(res.error ?? "Could not save");
  }
  async function deleteSaved(id: string) {
    const res = await deleteTemplateAction(id);
    if (res.ok) setSaved((s) => s.filter((x) => x.id !== id));
  }

  // ─── Drag and drop ──────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const setDropHint = (h: DropHint) => {
    if (JSON.stringify(h) === JSON.stringify(hintRef.current)) return;
    hintRef.current = h;
    setHint(h);
  };

  function onDragStart(e: DragStartEvent) {
    const d = e.active.data.current;
    setDragLabel(d?.fromLibrary || d?.kind ? String(d?.label ?? "") : null);
  }
  function onDragMove(e: DragMoveEvent) {
    const a = e.active.data.current, o = e.over?.data.current;
    if (!(a?.kind === "element" || a?.kind === "node") || o?.kind !== "node-target" || !e.over) return setDropHint(null);
    const ae = e.activatorEvent as PointerEvent;
    if (!("clientX" in ae)) return setDropHint({ nodeId: o.nodeId, pos: o.isContainer ? "inside" : "after" });
    const p = { x: ae.clientX + e.delta.x, y: ae.clientY + e.delta.y };
    setDropHint({ nodeId: o.nodeId, pos: dropPosition(e.over.rect, p, o.isContainer, o.axis) });
  }
  function onDragEnd(e: DragEndEvent) {
    const h = hintRef.current;
    setDragLabel(null);
    setDropHint(null);
    const { active, over } = e;
    if (!over) return;
    const a = active.data.current, o = over.data.current;
    const overSectionIndex = () => {
      if (o?.kind === "node-target") return page.sections.findIndex((s) => s.id === o.sectionId) + 1;
      return over.id === "canvas-end" ? page.sections.length : Math.max(0, page.sections.findIndex((s) => s.id === over.id));
    };

    if (a?.fromLibrary) {
      addSection(a.type as string, overSectionIndex());
      return;
    }
    if (a?.kind === "element" || a?.kind === "node") {
      let dest: { sectionId: string; nodeId: string | null; pos: DropPosition } | null = null;
      if (o?.kind === "node-target") dest = { sectionId: o.sectionId, nodeId: o.nodeId, pos: h && h.nodeId === o.nodeId ? h.pos : o.isContainer ? "inside" : "after" };
      else {
        const target = page.sections.find((s) => s.id === over.id);
        if (target?.type === "custom") dest = { sectionId: target.id, nodeId: null, pos: "inside" };
      }
      if (a.kind === "element") {
        insertSpec(a.spec as ElementSpec, dest ?? { sectionIndex: overSectionIndex() });
      } else if (dest) {
        moveNodeTo({ sectionId: a.sectionId, nodeId: a.nodeId }, dest);
      } else {
        // Dropped between ordinary sections: lift the element into a new custom section there.
        if (isHeaderSlot(a.sectionId)) return flash("Elements can't move between the header and the page — copy them instead.");
        const src = page.sections.find((s) => s.id === a.sectionId);
        const node = src?.nodes ? findNode(src.nodes, a.nodeId) : null;
        if (!node) return;
        const idx = overSectionIndex();
        const fresh = createCustomSection(newSectionId("custom"), [node.type === "container" ? node : createNode("container", { props: { contentWidth: "boxed" }, children: [node] })]);
        commitPage((secs) => {
          const without = secs.map((s) => (s.id === a.sectionId ? { ...s, nodes: removeNode(s.nodes ?? [], a.nodeId) } : s));
          return [...without.slice(0, idx), fresh, ...without.slice(idx)];
        });
        setSelection({ kind: "node", sectionId: fresh.id, nodeId: node.id });
      }
      return;
    }
    if (active.id !== over.id && over.id !== "canvas-end" && o?.kind !== "node-target") {
      commitPage((secs) => arrayMove(secs, secs.findIndex((s) => s.id === active.id), secs.findIndex((s) => s.id === over.id)));
    }
  }

  // ─── Pages ──────────────────────────────────────────────────────────────
  function addPage(from: "blank" | "canvas" | SavedTemplateItem) {
    setPageMenu(false);
    const suggested = typeof from === "object" ? from.name : "";
    const name = prompt("Page name, e.g. Delivery & returns", suggested);
    if (!name?.trim()) return;
    const slug = "/" + (slugify(name) || "page");
    if (config.pages.some((p) => p.slug === slug) || ["/products", "/collections", "/cart", "/checkout", "/orders", "/dashboard", "/store-builder", "/login", "/forgot-password", "/reset-password"].includes(slug)) return alert("That page address is already used.");
    const id = `page-${Math.random().toString(36).slice(2, 8)}`;
    const sections: Section[] =
      from === "blank" ? [createSection("text", { heading: name.trim() })]
      : from === "canvas" ? [createCustomSection(newSectionId("custom"), [createNode("container", { props: { contentWidth: "boxed" }, style: { desktop: { minHeight: { v: 360, u: "px" }, padding: { t: 40, r: 16, b: 40, l: 16, u: "px" }, gap: 16 } } })])]
      : from.kind === "PAGE" ? from.data.page.sections.map((s) => cloneSection(s, newSectionId(s.type))) : [];
    history.commit((c) => ({ ...c, pages: [...c.pages, { id, name: name.trim().slice(0, 60), slug, sections }] }));
    setPageId(id);
    setSelection({ kind: "page" });
  }

  // ─── Publish ────────────────────────────────────────────────────────────
  function publish() {
    startPublish(async () => {
      saveSeq.current++; // cancel pending autosave result handling
      let thrown = false;
      const res = await publishAction(config).catch(() => { thrown = true; return { error: "Couldn't reach the server — not published" }; });
      if (res.error) { setSave("error"); setSaveError(res.error); setStaleApp(thrown); return; }
      setSave("saved");
      setUnpublished(false);
      setIsLive(true);
    });
  }
  async function discard() {
    if (!confirm("Discard all changes since you last published?")) return;
    const res = await discardDraftAction();
    if (res.config) { firstRender.current = true; history.reset(res.config); setUnpublished(false); setSelection(null); setPageId(res.config.pages[0].id); }
  }

  // ─── Derived ────────────────────────────────────────────────────────────
  const selectedSection =
    selection?.kind === "section" ? page.sections.find((s) => s.id === selection.id) :
    selection?.kind === "header" ? config.header :
    selection?.kind === "footer" ? config.footer : undefined;

  const selectedNode = useMemo(() => {
    if (selection?.kind !== "node") return null;
    const sid = selection.sectionId;
    const sec = isHeaderSlot(sid) ? config.header : sid === "footer" ? config.footer : page.sections.find((s) => s.id === sid);
    const nodes = isHeaderSlot(sid) ? config.header[HEADER_SLOTS[sid]] ?? [] : sec?.nodes ?? [];
    const node = findNode(nodes, selection.nodeId);
    return sec && node ? { sec, sid, node, trail: nodePath(nodes, node.id) ?? [] } : null;
  }, [selection, page.sections, config.header, config.footer]);

  useEffect(() => {
    if (selection?.kind !== "node" && multi.length) setMulti([]);
  }, [selection, multi.length]);

  // A selection can vanish (undo, delete) — drop it rather than show nothing.
  useEffect(() => {
    if (selection?.kind === "node" && !selectedNode) setSelection(null);
    if (selection?.kind === "section" && !page.sections.some((s) => s.id === selection.id)) setSelection(null);
  }, [selection, selectedNode, page.sections]);

  const links: LinkOption[] = useMemo(() => [
    ...config.pages.map((p) => ({ value: p.slug, label: p.name })),
    { value: "/products", label: "All products" },
    { value: "/cart", label: "Cart" },
    ...baseCtx.categories.map((c) => ({ value: `/collections/${c.slug}`, label: `Category: ${c.name}` })),
    ...baseCtx.products.slice(0, 30).map((p) => ({ value: `/products/${p.slug}`, label: `Product: ${p.name}` })),
  ], [config.pages, baseCtx.categories, baseCtx.products]);

  const previewPath = (() => {
    const kind = sysKind(pageId);
    if (!kind) return page.slug;
    if (kind === "product") return baseCtx.products[0] ? `/products/${baseCtx.products[0].slug}` : "/products";
    if (kind === "collection") return baseCtx.categories[0] ? `/collections/${baseCtx.categories[0].slug}` : "/products";
    if (kind === "order") return "/products";
    return SYSTEM_PAGES.find((p) => p.kind === kind)!.slug;
  })();

  const saveLabel = { saved: "Saved", dirty: "Unsaved changes", saving: "Saving…", error: "Not saved" }[save];
  const savedPages = saved.filter((s) => s.kind === "PAGE");
  const DEVICE_BTNS: { d: Device; label: string; Icon: typeof Monitor }[] = [
    { d: "desktop", label: "Desktop", Icon: Monitor }, { d: "tablet", label: "Tablet", Icon: Tablet }, { d: "mobile", label: "Mobile", Icon: Smartphone },
  ];

  return (
    <DndContext id="store-editor" sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => { setDragLabel(null); setDropHint(null); }}>
      <FontLoader fonts={[...FONTS]} />
      {twCss && <style dangerouslySetInnerHTML={{ __html: twCss }} />}
      <div className="flex h-screen flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
          <Link href="/dashboard" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span></Link>
          <div className="h-6 w-px bg-zinc-200" />
          <select value={pageId} onChange={(e) => { setPageId(e.target.value); setSelection(null); setLogicFor(null); }} className="h-8 max-w-44 rounded-md border border-zinc-300 bg-white px-2 text-sm font-medium" aria-label="Page">
            <optgroup label="Your pages">{config.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
            <optgroup label="Shop pages">{SYSTEM_PAGES.map((p) => <option key={p.kind} value={`sys:${p.kind}`}>{p.name}</option>)}</optgroup>
          </select>
          <div className="relative">
            <button onClick={() => setPageMenu((o) => !o)} className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100" title="Add page"><Plus className="h-4 w-4" /></button>
            {pageMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPageMenu(false)} />
                <div className="absolute left-0 top-9 z-50 w-64 rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-lg">
                  <button onClick={() => addPage("blank")} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-zinc-100"><FileText className="h-4 w-4 text-zinc-500" /> Blank page</button>
                  <button onClick={() => addPage("canvas")} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-zinc-100"><LayoutTemplate className="h-4 w-4 text-zinc-500" /> Blank canvas (custom layout)</button>
                  {savedPages.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Your page templates</p>}
                  {savedPages.map((t) => (
                    <div key={t.id} className="group flex items-center">
                      <button onClick={() => addPage(t)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-zinc-100"><Bookmark className="h-4 w-4 shrink-0 text-brand-600" /><span className="truncate">{t.name}</span></button>
                      <button onClick={() => { if (confirm(`Delete page template "${t.name}"?`)) deleteSaved(t.id); }} className="hidden rounded p-1.5 text-zinc-400 hover:text-red-600 group-hover:block" aria-label={`Delete ${t.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={() => setSelection({ kind: "page" })} className={cn("rounded-md p-1.5 hover:bg-zinc-100", selection?.kind === "page" ? "bg-zinc-100 text-zinc-900" : "text-zinc-600")} title="Page settings"><FileText className="h-4 w-4" /></button>

          <div className="flex items-center rounded-lg border border-zinc-200 p-0.5" role="tablist" aria-label="Editor mode">
            {([["design", "Design", Paintbrush], ["workflows", "Workflows", Zap]] as const).map(([m, label, Icon]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setLogicFor(null); setPreviewCond(null); }} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", mode === m ? "bg-brand-600 text-white" : "text-zinc-600 hover:bg-zinc-100")}>
                <Icon className="h-3.5 w-3.5" /> <span className="hidden xl:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className={cn("mx-auto hidden items-center rounded-lg border border-zinc-200 p-0.5", mode === "design" && "md:flex")} role="group" aria-label="Preview device">
            {DEVICE_BTNS.map(({ d, label, Icon }) => (
              <button key={d} onClick={() => setDevice(d)} title={`${label} — style edits apply to ${label.toLowerCase()}${d === "desktop" ? " and smaller unless overridden" : ""}`} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", device === d ? "bg-zinc-900 text-white" : "text-zinc-600")}>
                <Icon className="h-3.5 w-3.5" /> <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={history.undo} disabled={!history.canUndo} className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30" title="Undo (⌘Z)"><Undo2 className="h-4 w-4" /></button>
            <button onClick={history.redo} disabled={!history.canRedo} className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30" title="Redo (⌘⇧Z)"><Redo2 className="h-4 w-4" /></button>
            <span className={cn("hidden items-center gap-1 px-2 text-xs lg:flex", save === "error" ? "text-red-600" : "text-zinc-500")} title={saveError ?? undefined}>
              {save === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : save === "error" ? <CloudOff className="h-3.5 w-3.5" /> : save === "saved" ? <Check className="h-3.5 w-3.5" /> : null}
              {saveLabel}
            </span>
            <a href={`${previewBase}${previewPath === "/" ? (previewBase ? "" : "/") : previewPath}?preview=draft`} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-xs font-medium hover:bg-zinc-50"><Eye className="h-3.5 w-3.5" /> Preview</a>
            {hasPublished && unpublished && <button onClick={discard} className="hidden h-8 rounded-md px-2.5 text-xs text-zinc-500 hover:bg-zinc-100 xl:block">Discard changes</button>}
            {canPublish ? (
              <Button size="sm" onClick={publish} disabled={publishing || (!unpublished && isLive)}>
                {publishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {!isLive ? "Publish store" : unpublished ? "Publish changes" : "Published"}
              </Button>
            ) : (
              <span className="text-xs text-zinc-500">Owner publishes</span>
            )}
          </div>
        </header>
        {save === "error" && saveError && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-red-50 px-4 py-1.5 text-center text-xs text-red-700">
            {staleApp ? (
              <>
                <span>Your changes couldn&apos;t be saved — the editor was probably updated while this tab was open. They&apos;re kept on this device.</span>
                <button onClick={() => window.location.reload()} className="rounded bg-red-600 px-2 py-0.5 font-semibold text-white hover:bg-red-700">Reload editor</button>
                <button onClick={() => persist(config)} className="font-semibold underline">Try again</button>
              </>
            ) : (
              <>
                <span>{saveError}</span>
                <button onClick={() => persist(config)} className="font-semibold underline">Try again</button>
              </>
            )}
          </div>
        )}
        {backup && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
            <span>You have changes from {new Date(backup.savedAt).toLocaleString()} that weren&apos;t saved.</span>
            <button onClick={() => { history.commit(backup.config); setBackup(null); }} className="rounded bg-amber-600 px-2 py-0.5 font-semibold text-white hover:bg-amber-700">Restore them</button>
            <button onClick={() => { try { localStorage.removeItem(backupKey); } catch { /* ignore */ } setBackup(null); }} className="font-semibold underline">Discard</button>
          </div>
        )}
        {isLive && !unpublished && <div className="bg-green-50 px-4 py-1.5 text-center text-xs text-green-800">Your store is live at <a className="font-semibold underline" href={liveUrl} target="_blank" rel="noreferrer">{liveUrl.replace(/^https?:\/\//, "")}</a></div>}
        {notice && <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">{notice}</div>}

        {mode === "workflows" ? (
          <WorkflowsView config={config} setWorkflows={setWorkflows} selectedId={workflowId} setSelectedId={setWorkflowId} products={baseCtx.products} links={links} />
        ) : (
        <div className="flex min-h-0 flex-1">
          {/* Left panel */}
          <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
            <div className="flex border-b border-zinc-200 p-1">
              <button onClick={() => setLeftTab("add")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium", leftTab === "add" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500")}><Plus className="h-3.5 w-3.5" /> Add</button>
              <button onClick={() => setLeftTab("layers")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium", leftTab === "layers" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500")}><Layers className="h-3.5 w-3.5" /> Navigator</button>
              <button onClick={() => setSelection({ kind: "theme" })} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium", selection?.kind === "theme" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500")}><Palette className="h-3.5 w-3.5" /> Theme</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {leftTab === "add" ? (
                <ComponentLibrary onAdd={(t) => addSection(t)} onAddElement={(spec) => insertSpec(spec)} saved={saved} onDeleteSaved={deleteSaved} />
              ) : (
                <Navigator
                  sections={page.sections}
                  headerNodes={config.header.settings.topBar === true && config.header.settings.topBarMode === "custom" ? config.header.nodes : undefined}
                  navNodes={config.header.settings.navElements === true && config.header.settings.navMode !== "custom" ? config.header.navNodes : undefined}
                  barNodes={config.header.settings.navMode === "custom" ? config.header.barNodes : undefined}
                  selection={selection}
                  onSelect={(s) => { setSelection(s); scrollTo(s.kind === "node" ? `[data-node-id="${s.nodeId}"]` : s.kind === "section" ? `[data-section-id="${s.id}"]` : "body"); }}
                  onShift={(sid, nid, dir) => updateNodes(sid, (ns) => shiftNode(ns, nid, dir))}
                  onMoveSection={actions.onMove}
                />
              )}
            </div>
          </aside>

          {/* Canvas */}
          <main className="min-w-0 flex-1 overflow-auto bg-zinc-200/70 p-4 md:p-6">
            {isSystemPage && (
              <p className="mx-auto mb-3 flex max-w-3xl items-center justify-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-center text-xs text-zinc-600 shadow-sm">
                <ShoppingBag className="h-4 w-4 shrink-0 text-brand-600" />
                <span>Editing the <b>{page.name}</b> layout. The block marked with the page&apos;s own content can be moved; add any sections above or below it.</span>
              </p>
            )}
            <Canvas config={config} page={page} ctx={ctx} device={device} selection={selection} setSelection={setSelection} actions={actions} nodeApi={nodeApi} previewId={previewCond} />
            <p className="mt-4 text-center text-xs text-zinc-500 md:hidden">Open the editor on a larger screen to add and edit sections.</p>
          </main>

          {/* Right panel */}
          <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white p-4 lg:block">
            {selectedNode && multi.length > 0 ? (
              <MultiProperties
                count={multi.length + 1}
                sameParent={new Set([selectedNode.node.id, ...multi].map((id) => findParent(getNodes(selectedNode.sid), id)?.parent?.id ?? "root")).size === 1}
                onGroup={groupSelected}
                onDelete={deleteSelected}
                onClear={() => setMulti([])}
              />
            ) : selectedNode ? (
              <NodeProperties
                key={selectedNode.node.id}
                node={selectedNode.node}
                trail={selectedNode.trail}
                sectionLabel={isHeaderSlot(selectedNode.sid) ? SLOT_LABEL[selectedNode.sid] : SECTION_MAP[selectedNode.sec.type]?.label ?? "Section"}
                device={device}
                style={selectedNode.node.style}
                setProp={(k, v) => setNodeProp({ sectionId: selectedNode.sid, nodeId: selectedNode.node.id }, k, v)}
                setStyle={nodeStyleSetter({ sectionId: selectedNode.sid, nodeId: selectedNode.node.id })}
                themeVars={tv}
                links={links}
                categories={baseCtx.categories}
                onCopy={() => copySelection()}
                onPaste={() => pasteClip()}
                setTw={(v) => updateNodes(selectedNode.sid, (ns) => updateNode(ns, selectedNode.node.id, (n) => ({ ...n, tw: v.trim() ? v : undefined })), `ntw:${selectedNode.node.id}`)}
                canPaste={!!clip}
                onSelect={(id) => setSelection({ kind: "node", sectionId: selectedNode.sid, nodeId: id })}
                onSelectSection={() => setSelection(sectionSelection(selectedNode.sid))}
                onDuplicate={() => duplicateNodeAt({ sectionId: selectedNode.sid, nodeId: selectedNode.node.id })}
                onDelete={() => removeNodeAt({ sectionId: selectedNode.sid, nodeId: selectedNode.node.id })}
                onSaveBlock={() => saveTemplate("BLOCK", { node: selectedNode.node }, elementLabel(selectedNode.node.type))}
                onLogic={() => setLogicFor({ sectionId: selectedNode.sid, nodeId: selectedNode.node.id })}
                onArrange={(a) => arrange({ sectionId: selectedNode.sid, nodeId: selectedNode.node.id }, a)}
                parentDir={parentDirection(selectedNode.sid, selectedNode.trail)}
              />
            ) : selectedSection && selectedTarget ? (
              <SectionTabs
                key={selectedTarget}
                section={selectedSection}
                device={device}
                setStyle={sectionStyleSetter(selectedTarget)}
                themeVars={tv}
                onChange={(k, v) => setSettingFor(selectedTarget, k, v)}
                categories={baseCtx.categories}
                links={links}
                onSaveBlock={selection?.kind === "section" ? () => actions.onSaveBlock(selection.id) : undefined}
                onCopy={selection?.kind === "section" && !SECTION_MAP[selectedSection.type]?.system ? () => copySelection() : undefined}
                setTw={(v) => updateSection(selectedTarget, (s) => ({ ...s, tw: v.trim() ? v : undefined }), `stw:${selectedTarget}`)}
                onCustomise={selection?.kind === "section" && selectedSection.type === "product-grid" ? () => customiseGrid(selection.id) : undefined}
              />
            ) : selection?.kind === "theme" ? (
              <ThemeProperties
                config={config}
                onTheme={(patch: Partial<Theme>) => history.commit((c) => ({ ...c, theme: { ...c.theme, ...patch } }), `theme:${Object.keys(patch)[0]}`)}
                onSeo={(patch) => history.commit((c) => ({ ...c, seo: { ...c.seo, ...patch } }), `seo:${Object.keys(patch)[0]}`)}
              />
            ) : selection?.kind === "page" && isSystemPage ? (
              <div className="flex flex-col gap-2 text-sm text-zinc-600">
                <p className="font-semibold text-zinc-900">{page.name}</p>
                <p>A built-in shop page at <code className="rounded bg-zinc-100 px-1">{page.slug}</code>. Its address and content come from your products and orders; you design what goes around it.</p>
              </div>
            ) : selection?.kind === "page" ? (
              <PageProperties
                page={page}
                onChange={(patch) => history.commit((c) => updatePage(c, pageId, (p) => ({ ...p, ...patch })), `page:${pageId}:${Object.keys(patch)[0]}`)}
                onDelete={() => { if (!confirm(`Delete the ${page.name} page?`)) return; history.commit((c) => ({ ...c, pages: c.pages.filter((p) => p.id !== pageId) })); setPageId(config.pages[0].id); setSelection(null); }}
                onSaveTemplate={() => saveTemplate("PAGE", { page }, page.name)}
              />
            ) : (
              <div className="flex flex-col gap-3 text-sm text-zinc-500">
                <p className="font-semibold text-zinc-900">Edit your store</p>
                <p>Click any section or element to edit it. <b>Double-click any text</b> to type straight onto the page.</p>
                <p><b>Build your own layout:</b> drag a column layout or an element (heading, image, button…) from the left panel onto the page, then drop more elements into its containers.</p>
                <p>Select an element to drag its edges (size), the green bands (padding) or the orange bands (margin). Switch to <b>Tablet</b> or <b>Mobile</b> at the top to adjust each device separately.</p>
                <p>Changes save automatically as a draft. Customers see them only after you <b>publish</b>.</p>
                <button onClick={() => setSelection({ kind: "theme" })} className="mt-2 flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-left text-zinc-700 hover:border-brand-500"><Palette className="h-4 w-4" /> Change colours & fonts</button>
              </div>
            )}
          </aside>
        </div>
        )}
      </div>
      {mode === "design" && logicFor && selectedNode && selectedNode.node.id === logicFor.nodeId && (
        <ElementLogicDialog
          key={logicFor.nodeId}
          node={selectedNode.node}
          config={config}
          onClose={() => setLogicFor(null)}
          setConditions={setConditions(logicFor)}
          setWorkflows={setWorkflows}
          openWorkflow={openWorkflow}
          previewId={previewCond}
          setPreviewId={setPreviewCond}
          themeVars={tv}
          products={baseCtx.products}
        />
      )}
      <DragOverlay dropAnimation={null}>
        {dragLabel && <div className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-xl">{dragLabel}</div>}
      </DragOverlay>
    </DndContext>
  );
}
