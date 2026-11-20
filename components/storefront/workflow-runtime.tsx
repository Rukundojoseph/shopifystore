"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { safeHref, STAFF_ACTIONS, type Workflow, type WorkflowAction } from "@/lib/editor/schema";
import { runStaffActionAction } from "@/lib/storefront/workflow-actions";
import { useCart } from "./cart";
import { href, type StorefrontCtx } from "./types";
import { WorkflowRunContext, type WorkflowRunApi } from "./workflow-context";

// Runs the merchant's workflows on the live store (never inside the editor).
//
// State lives as space-separated lists on the root element so conditions can
// be plain CSS (see conditionSelector in nodes.tsx):
//   data-sf-states  — elements whose "clicked"/toggled state is on
//   data-sf-hidden / data-sf-shown — show/hide actions
//   data-sf-scroll  — scroll thresholds the visitor has passed

type Env = { form?: Record<string, string>; formEl?: HTMLFormElement; formName?: string };
type PageRef = { id: string; slug: string };

const SYSTEM_ROUTES: [RegExp, string][] = [
  [/^\/products$/, "sys:shop"], [/^\/products\/.+/, "sys:product"], [/^\/collections\/.+/, "sys:collection"],
  [/^\/cart$/, "sys:cart"], [/^\/checkout$/, "sys:checkout"], [/^\/orders\/.+/, "sys:order"],
];

const toggleIn = (set: Set<string>, id: string, on?: boolean) => {
  const next = new Set(set);
  if (on ?? !next.has(id)) next.add(id); else next.delete(id);
  return next;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function WorkflowRoot({ ctx, workflows, pages, className, style, children }: {
  ctx: StorefrontCtx;
  workflows: Workflow[];
  pages: PageRef[];
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const cart = useCart();
  const root = useRef<HTMLDivElement>(null);
  const [states, setStates] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [scrolled, setScrolled] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const lastError = useRef<string | null>(null);
  const statesRef = useRef(states);
  statesRef.current = states;
  const active = useMemo(() => workflows.filter((w) => !w.disabled), [workflows]);
  const live = !ctx.editing && !ctx.demo;

  const relPath = ctx.base && pathname.startsWith(ctx.base) ? pathname.slice(ctx.base.length) || "/" : pathname;
  const pageId = pages.find((p) => p.slug === relPath)?.id ?? SYSTEM_ROUTES.find(([re]) => re.test(relPath))?.[1] ?? null;

  const say = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  const postForm = useCallback(async (env: Env): Promise<{ ok: boolean; message?: string }> => {
    const res = await fetch("/api/storefront/forms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId: ctx.store.id, form: env.formName ?? "Form", path: relPath, fields: env.form ?? {}, _hp: env.formEl ? String(new FormData(env.formEl).get("_hp") ?? "") : "" }),
    }).catch(() => null);
    if (res?.ok) return { ok: true };
    const body = await res?.json().catch(() => null);
    return { ok: false, message: body?.error ?? "Something went wrong. Please try again." };
  }, [ctx.store.id, relPath]);

  const whenHolds = useCallback((w: Workflow) => {
    const c = w.when;
    if (!c) return true;
    if (c.type === "width") {
      const width = root.current?.clientWidth ?? window.innerWidth;
      return (c.min === undefined || width >= c.min) && (c.max === undefined || width <= c.max);
    }
    if (c.type === "scrolled") return window.scrollY >= c.offset;
    return statesRef.current.has(c.nodeId);
  }, []);

  /** Runs one step. Returns false to stop the rest of the workflow. */
  const exec = useCallback(async (a: WorkflowAction, w: Workflow, env: Env): Promise<boolean> => {
    switch (a.type) {
      case "goToPage": {
        const to = safeHref(a.to, "/");
        if (/^https?:/i.test(to)) window.location.href = to; else router.push(href(ctx, to));
        return true;
      }
      case "openUrl": {
        const url = safeHref(a.url, "");
        if (!url) return true;
        if (a.newTab) window.open(url, "_blank", "noopener,noreferrer"); else window.location.href = url;
        return true;
      }
      case "scrollTo":
        if (a.nodeId) root.current?.querySelector(`.n-${a.nodeId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
        return true;
      case "show": setShown((s) => toggleIn(s, a.nodeId, true)); setHidden((s) => toggleIn(s, a.nodeId, false)); return true;
      case "hide": setHidden((s) => toggleIn(s, a.nodeId, true)); setShown((s) => toggleIn(s, a.nodeId, false)); return true;
      case "toggle": {
        const el = root.current?.querySelector(`.n-${a.nodeId}`);
        const visible = !!el && getComputedStyle(el).display !== "none";
        setHidden((s) => toggleIn(s, a.nodeId, visible));
        setShown((s) => toggleIn(s, a.nodeId, !visible));
        return true;
      }
      case "toggleState": setStates((s) => toggleIn(s, a.nodeId)); return true;
      case "showMessage": if (a.text) say(a.text); return true;
      case "wait": await sleep(Math.min(10_000, Math.max(0, a.ms))); return true;
      case "addToCart": {
        const p = ctx.products.find((x) => x.id === a.productId);
        if (!p) return true;
        if (p.hasVariants || !p.inStock) { router.push(href(ctx, `/products/${p.slug}`)); return false; }
        cart.add({ productId: p.id, variantId: null, name: p.name, variantName: null, price: p.price, image: p.image, quantity: Math.round(a.quantity) || 1, slug: p.slug });
        say(`${p.name} added to your cart`);
        return true;
      }
      case "submitForm": {
        if (!env.form) return true;
        const res = await postForm(env);
        if (!res.ok) { lastError.current = res.message ?? "Could not send"; say(lastError.current); return false; }
        return true;
      }
      case "subscribe": {
        const email = env.form?.[a.field];
        if (!email) return true;
        const res = await fetch("/api/storefront/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId: ctx.store.id, email }) }).catch(() => null);
        if (!res?.ok) { lastError.current = "Please enter a valid email address."; say(lastError.current); return false; }
        return true;
      }
      case "resetForm": env.formEl?.reset(); return true;
      default: {
        if (!STAFF_ACTIONS.has(a.type)) return true;
        const res = await runStaffActionAction({ storeId: ctx.store.id, workflowId: w.id, actionId: a.id, values: env.form ?? {} }).catch(() => ({ error: "Network error" } as { error: string; denied?: true; message?: string }));
        if ("denied" in res && res.denied) return false; // not staff: silently do nothing
        if ("error" in res && res.error) { lastError.current = res.error; say(res.error); return false; }
        if ("message" in res && res.message) say(res.message);
        router.refresh();
        return true;
      }
    }
  }, [cart, ctx, postForm, router, say]);

  const run = useCallback(async (w: Workflow, env: Env = {}): Promise<boolean> => {
    if (!whenHolds(w)) return true;
    for (const a of w.actions) if (!(await exec(a, w, env))) return false;
    return true;
  }, [exec, whenHolds]);

  // ─── Triggers ─────────────────────────────────────────────────────────────
  const clickMap = useMemo(() => {
    const m = new Map<string, Workflow[]>();
    for (const w of active) if (w.trigger.type === "click") m.set(w.trigger.nodeId, [...(m.get(w.trigger.nodeId) ?? []), w]);
    return m;
  }, [active]);

  function onClick(e: React.MouseEvent) {
    if (!live) return;
    let el = (e.target as HTMLElement).closest<HTMLElement>("[data-nid]");
    let toggled = false, ran = false;
    while (el && root.current?.contains(el)) {
      const id = el.dataset.nid!;
      if (!toggled && el.hasAttribute("data-sf-click")) { setStates((s) => toggleIn(s, id)); toggled = true; }
      const wfs = clickMap.get(id);
      if (!ran && wfs?.length) {
        // A workflow replaces the element's own link.
        if ((e.target as HTMLElement).closest("a")) e.preventDefault();
        for (const w of wfs) void run(w);
        ran = true;
      }
      el = el.parentElement?.closest<HTMLElement>("[data-nid]") ?? null;
    }
  }

  // Page load
  useEffect(() => {
    if (!live || !pageId) return;
    for (const w of active) if (w.trigger.type === "pageLoad" && w.trigger.pageId === pageId) void run(w);
  }, [pageId, live]); // eslint-disable-line react-hooks/exhaustive-deps -- once per page view

  // Scroll: thresholds for conditions + scroll-triggered workflows (once per page view).
  useEffect(() => {
    if (!live) return;
    const fired = new Set<string>();
    const thresholds = new Set<number>();
    root.current?.querySelectorAll<HTMLElement>("[data-sf-scroll-at]").forEach((el) => el.dataset.sfScrollAt!.split(" ").forEach((n) => thresholds.add(Number(n))));
    const onScroll = () => {
      const y = window.scrollY;
      const reached = [...thresholds].filter((t) => y >= t).sort((a, b) => a - b);
      setScrolled((prev) => (prev.join() === reached.join() ? prev : reached));
      for (const w of active) {
        if (w.trigger.type === "scroll" && w.trigger.pageId === pageId && y >= w.trigger.offset && !fired.has(w.id)) { fired.add(w.id); void run(w); }
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pageId, live, active, run]);

  // Forms
  const api: WorkflowRunApi = useMemo(() => ({
    submit: async (formNodeId, formEl) => {
      const fd = new FormData(formEl);
      const form: Record<string, string> = {};
      fd.forEach((v, k) => { if (k !== "_hp" && typeof v === "string") form[k] = v.slice(0, 2000); });
      const env: Env = { form, formEl, formName: formEl.dataset.formName };
      const wfs = active.filter((w) => w.trigger.type === "submit" && w.trigger.nodeId === formNodeId);
      if (!wfs.length) {
        const res = await postForm(env);
        if (res.ok) formEl.reset();
        return res;
      }
      lastError.current = null;
      for (const w of wfs) if (!(await run(w, env))) return { ok: false, message: lastError.current ?? "Not sent." };
      return { ok: true };
    },
  }), [active, postForm, run]);

  // CSS for elements that workflows show, hide or make clickable.
  const css = useMemo(() => {
    const ids = new Set<string>(), clickable = new Set<string>();
    for (const w of active) {
      if (w.trigger.type === "click") clickable.add(w.trigger.nodeId);
      for (const a of w.actions) if ((a.type === "show" || a.type === "hide" || a.type === "toggle") && a.nodeId) ids.add(a.nodeId);
    }
    return [
      ...[...ids].map((id) => `[data-sf-hidden~="${id}"] .n-${id}{display:none!important}[data-sf-shown~="${id}"] .n-${id}{display:revert-layer!important}`),
      ...[...clickable].map((id) => `.n-${id}{cursor:pointer}`),
    ].join("");
  }, [active]);

  return (
    <div
      ref={root}
      data-sf-root=""
      data-sf-states={[...states].join(" ") || undefined}
      data-sf-hidden={[...hidden].join(" ") || undefined}
      data-sf-shown={[...shown].join(" ") || undefined}
      data-sf-scroll={scrolled.join(" ") || undefined}
      className={className}
      style={style}
      // Capture phase: runs before an element's own <Link> handler, so a
      // workflow can cancel the link's navigation.
      onClickCapture={onClick}
    >
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <WorkflowRunContext.Provider value={live ? api : null}>{children}</WorkflowRunContext.Provider>
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-[100] max-w-[90vw] -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-xl">{toast}</div>
      )}
    </div>
  );
}
