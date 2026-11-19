"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowLeft, Check, CloudOff, Eye, Loader2, Monitor, Palette, Plus, Redo2, Smartphone, Undo2, Layers, FileText } from "lucide-react";
import type { Section, SettingValue, SiteConfig, SitePage, Theme } from "@/lib/editor/schema";
import { SECTION_MAP, createSection, newSectionId } from "@/lib/editor/sections";
import type { StorefrontCtx } from "@/components/storefront/types";
import { Button, cn } from "@/components/ui";
import { slugify } from "@/lib/slug";
import { useHistory } from "./use-history";
import { ComponentLibrary, SECTION_ICONS } from "./library";
import { Canvas, type Selection } from "./canvas";
import { PageProperties, SectionProperties, ThemeProperties, type LinkOption } from "./properties";
import { FontLoader } from "./font-loader";
import { discardDraftAction, publishAction, saveDraftAction } from "@/app/store-builder/actions";

type SaveState = "saved" | "dirty" | "saving" | "error";

type Props = {
  initialConfig: SiteConfig;
  ctx: StorefrontCtx;
  storeSlug: string;
  status: "DRAFT" | "PUBLISHED" | "SUSPENDED";
  canPublish: boolean;
  hasPublished: boolean;
  publishedDiffers: boolean;
  liveUrl: string;
};

function updatePage(config: SiteConfig, pageId: string, fn: (p: SitePage) => SitePage): SiteConfig {
  return { ...config, pages: config.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

export function Editor({ initialConfig, ctx: baseCtx, storeSlug, status, canPublish, hasPublished, publishedDiffers, liveUrl }: Props) {
  const history = useHistory<SiteConfig>(initialConfig);
  const config = history.value;
  const [pageId, setPageId] = useState(config.pages[0].id);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [leftTab, setLeftTab] = useState<"add" | "layers">("add");
  const [save, setSave] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unpublished, setUnpublished] = useState(publishedDiffers || status !== "PUBLISHED");
  const [isLive, setIsLive] = useState(status === "PUBLISHED");
  const [publishing, startPublish] = useTransition();
  const [dragType, setDragType] = useState<string | null>(null);
  const firstRender = useRef(true);
  const saveSeq = useRef(0);

  const page = config.pages.find((p) => p.id === pageId) ?? config.pages[0];
  const ctx: StorefrontCtx = useMemo(() => ({ ...baseCtx, theme: config.theme, editing: true }), [baseCtx, config.theme]);

  // ─── Autosave (debounced) ────────────────────────────────────────────────
  const persist = useCallback(async (value: SiteConfig) => {
    const seq = ++saveSeq.current;
    setSave("saving");
    const res = await saveDraftAction(value).catch(() => ({ error: "Network error — changes not saved" }));
    if (seq !== saveSeq.current) return; // a newer save superseded this one
    if ("error" in res && res.error) { setSave("error"); setSaveError(res.error); }
    else { setSave("saved"); setSaveError(null); }
  }, []);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSave("dirty");
    setUnpublished(true);
    const t = setTimeout(() => persist(config), 1200);
    return () => clearTimeout(t);
  }, [config, persist]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (save === "dirty" || save === "saving") e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) history.redo(); else history.undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") { e.preventDefault(); history.redo(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selection?.kind === "section") { e.preventDefault(); removeSection(selection.id); }
      if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ─── Section operations ─────────────────────────────────────────────────
  const commitPage = (fn: (sections: Section[]) => Section[], key: string | null = null) =>
    history.commit((c) => updatePage(c, pageId, (p) => ({ ...p, sections: fn(p.sections) })), key);

  function addSection(type: string, index?: number) {
    const s = createSection(type);
    commitPage((secs) => {
      const selIdx = selection?.kind === "section" ? secs.findIndex((x) => x.id === selection.id) : -1;
      const at = index ?? (selIdx >= 0 ? selIdx + 1 : secs.length);
      return [...secs.slice(0, at), s, ...secs.slice(at)];
    });
    setSelection({ kind: "section", id: s.id });
    setTimeout(() => document.querySelector(`[data-section-id="${s.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }
  function removeSection(id: string) {
    commitPage((secs) => secs.filter((s) => s.id !== id));
    setSelection(null);
  }
  const actions = {
    onSelect: (id: string) => setSelection({ kind: "section", id }),
    onMove: (id: string, dir: -1 | 1) => commitPage((secs) => { const i = secs.findIndex((s) => s.id === id); const j = i + dir; return j < 0 || j >= secs.length ? secs : arrayMove(secs, i, j); }),
    onDuplicate: (id: string) => {
      const copyId = newSectionId(page.sections.find((s) => s.id === id)?.type ?? "section");
      commitPage((secs) => { const i = secs.findIndex((s) => s.id === id); return [...secs.slice(0, i + 1), { ...structuredClone(secs[i]), id: copyId }, ...secs.slice(i + 1)]; });
      setSelection({ kind: "section", id: copyId });
    },
    onToggle: (id: string) => commitPage((secs) => secs.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s))),
    onDelete: removeSection,
  };

  function setSetting(key: string, value: SettingValue) {
    if (!selection) return;
    const ck = `${selection.kind}:${"id" in selection ? selection.id : ""}:${key}`;
    if (selection.kind === "header" || selection.kind === "footer") {
      const k = selection.kind;
      history.commit((c) => ({ ...c, [k]: { ...c[k], settings: { ...c[k].settings, [key]: value } } }), ck);
    } else if (selection.kind === "section") {
      const id = selection.id;
      commitPage((secs) => secs.map((s) => (s.id === id ? { ...s, settings: { ...s.settings, [key]: value } } : s)), ck);
    }
  }

  // ─── Drag and drop ──────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function onDragStart(e: DragStartEvent) {
    setDragType(e.active.data.current?.fromLibrary ? (e.active.data.current.type as string) : null);
  }
  function onDragEnd(e: DragEndEvent) {
    setDragType(null);
    const { active, over } = e;
    if (!over) return;
    if (active.data.current?.fromLibrary) {
      const idx = over.id === "canvas-end" ? page.sections.length : page.sections.findIndex((s) => s.id === over.id);
      addSection(active.data.current.type as string, idx < 0 ? page.sections.length : idx);
      return;
    }
    if (active.id !== over.id && over.id !== "canvas-end") {
      commitPage((secs) => arrayMove(secs, secs.findIndex((s) => s.id === active.id), secs.findIndex((s) => s.id === over.id)));
    }
  }

  // ─── Pages ──────────────────────────────────────────────────────────────
  function addPage() {
    const name = prompt("Page name, e.g. Delivery & returns");
    if (!name?.trim()) return;
    const slug = "/" + (slugify(name) || "page");
    if (config.pages.some((p) => p.slug === slug) || ["/products", "/collections", "/cart", "/checkout", "/orders"].includes(slug)) return alert("That page address is already used.");
    const id = `page-${Math.random().toString(36).slice(2, 8)}`;
    history.commit((c) => ({ ...c, pages: [...c.pages, { id, name: name.trim().slice(0, 60), slug, sections: [createSection("text", { heading: name.trim() })] }] }));
    setPageId(id);
    setSelection({ kind: "page" });
  }

  // ─── Publish ────────────────────────────────────────────────────────────
  function publish() {
    startPublish(async () => {
      saveSeq.current++; // cancel pending autosave result handling
      const res = await publishAction(config);
      if (res.error) { setSave("error"); setSaveError(res.error); return; }
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

  const links: LinkOption[] = useMemo(() => [
    ...config.pages.map((p) => ({ value: p.slug, label: p.name })),
    { value: "/products", label: "All products" },
    { value: "/cart", label: "Cart" },
    ...baseCtx.categories.map((c) => ({ value: `/collections/${c.slug}`, label: `Category: ${c.name}` })),
    ...baseCtx.products.slice(0, 30).map((p) => ({ value: `/products/${p.slug}`, label: `Product: ${p.name}` })),
  ], [config.pages, baseCtx.categories, baseCtx.products]);

  const saveLabel = { saved: "Saved", dirty: "Unsaved changes", saving: "Saving…", error: "Not saved" }[save];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragType(null)}>
      <FontLoader fonts={[config.theme.font, config.theme.headingFont]} />
      <div className="flex h-screen flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
          <Link href="/dashboard" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span></Link>
          <div className="h-6 w-px bg-zinc-200" />
          <select value={pageId} onChange={(e) => { setPageId(e.target.value); setSelection(null); }} className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm font-medium" aria-label="Page">
            {config.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={addPage} className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100" title="Add page"><Plus className="h-4 w-4" /></button>
          <button onClick={() => setSelection({ kind: "page" })} className={cn("rounded-md p-1.5 hover:bg-zinc-100", selection?.kind === "page" ? "bg-zinc-100 text-zinc-900" : "text-zinc-600")} title="Page settings"><FileText className="h-4 w-4" /></button>

          <div className="mx-auto hidden items-center rounded-lg border border-zinc-200 p-0.5 md:flex">
            {(["desktop", "mobile"] as const).map((d) => (
              <button key={d} onClick={() => setDevice(d)} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", device === d ? "bg-zinc-900 text-white" : "text-zinc-600")}>
                {d === "desktop" ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />} {d === "desktop" ? "Desktop" : "Mobile"}
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
            <a href={`/s/${storeSlug}${page.slug === "/" ? "" : page.slug}?preview=draft`} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-xs font-medium hover:bg-zinc-50"><Eye className="h-3.5 w-3.5" /> Preview</a>
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
        {save === "error" && saveError && <div className="bg-red-50 px-4 py-1.5 text-center text-xs text-red-700">{saveError}</div>}
        {isLive && !unpublished && <div className="bg-green-50 px-4 py-1.5 text-center text-xs text-green-800">Your store is live at <a className="font-semibold underline" href={liveUrl} target="_blank" rel="noreferrer">{liveUrl.replace(/^https?:\/\//, "")}</a></div>}

        <div className="flex min-h-0 flex-1">
          {/* Left panel */}
          <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
            <div className="flex border-b border-zinc-200 p-1">
              <button onClick={() => setLeftTab("add")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium", leftTab === "add" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500")}><Plus className="h-3.5 w-3.5" /> Add</button>
              <button onClick={() => setLeftTab("layers")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium", leftTab === "layers" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500")}><Layers className="h-3.5 w-3.5" /> Sections</button>
              <button onClick={() => setSelection({ kind: "theme" })} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium", selection?.kind === "theme" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500")}><Palette className="h-3.5 w-3.5" /> Theme</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {leftTab === "add" ? (
                <ComponentLibrary onAdd={(t) => addSection(t)} />
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  <li><button onClick={() => setSelection({ kind: "header" })} className={cn("w-full rounded-md px-2 py-1.5 text-left", selection?.kind === "header" ? "bg-brand-50 text-brand-700" : "hover:bg-zinc-100")}>Navigation bar</button></li>
                  {page.sections.map((s) => {
                    const Icon = SECTION_ICONS[s.type];
                    return (
                      <li key={s.id}>
                        <button onClick={() => setSelection({ kind: "section", id: s.id })} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", selection?.kind === "section" && selection.id === s.id ? "bg-brand-50 text-brand-700" : "hover:bg-zinc-100", s.hidden && "opacity-50")}>
                          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{String(s.settings.heading || s.settings.text || SECTION_MAP[s.type]?.label)}</span>
                        </button>
                      </li>
                    );
                  })}
                  <li><button onClick={() => setSelection({ kind: "footer" })} className={cn("w-full rounded-md px-2 py-1.5 text-left", selection?.kind === "footer" ? "bg-brand-50 text-brand-700" : "hover:bg-zinc-100")}>Footer</button></li>
                </ul>
              )}
            </div>
          </aside>

          {/* Canvas */}
          <main className="min-w-0 flex-1 overflow-y-auto bg-zinc-200/70 p-4 md:p-6">
            <Canvas config={config} pageId={pageId} ctx={ctx} device={device} selection={selection} setSelection={setSelection} actions={actions} />
            <p className="mt-4 text-center text-xs text-zinc-500 md:hidden">Open the editor on a larger screen to add and edit sections.</p>
          </main>

          {/* Right panel */}
          <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white p-4 lg:block">
            {selectedSection ? (
              <SectionProperties section={selectedSection} onChange={setSetting} categories={baseCtx.categories} links={links} />
            ) : selection?.kind === "theme" ? (
              <ThemeProperties
                config={config}
                onTheme={(patch: Partial<Theme>) => history.commit((c) => ({ ...c, theme: { ...c.theme, ...patch } }), `theme:${Object.keys(patch)[0]}`)}
                onSeo={(patch) => history.commit((c) => ({ ...c, seo: { ...c.seo, ...patch } }), `seo:${Object.keys(patch)[0]}`)}
              />
            ) : selection?.kind === "page" ? (
              <PageProperties
                page={page}
                onChange={(patch) => history.commit((c) => updatePage(c, pageId, (p) => ({ ...p, ...patch })), `page:${pageId}:${Object.keys(patch)[0]}`)}
                onDelete={() => { if (!confirm(`Delete the ${page.name} page?`)) return; history.commit((c) => ({ ...c, pages: c.pages.filter((p) => p.id !== pageId) })); setPageId(config.pages[0].id); setSelection(null); }}
              />
            ) : (
              <div className="flex flex-col gap-3 text-sm text-zinc-500">
                <p className="font-semibold text-zinc-900">Edit your store</p>
                <p>Click any section on the page to edit its text, images and colours.</p>
                <p>Drag sections from the left panel onto the page, or click one to add it below the selected section.</p>
                <p>Changes save automatically as a draft. Customers see them only after you <b>publish</b>.</p>
                <button onClick={() => setSelection({ kind: "theme" })} className="mt-2 flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-left text-zinc-700 hover:border-brand-500"><Palette className="h-4 w-4" /> Change colours & fonts</button>
              </div>
            )}
          </aside>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {dragType && <div className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-xl">{SECTION_MAP[dragType]?.label}</div>}
      </DragOverlay>
    </DndContext>
  );
}
