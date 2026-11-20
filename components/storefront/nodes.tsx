/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { createContext, useContext, useLayoutEffect, useRef, useState, type FormEvent, type HTMLAttributes, type ReactNode, type Ref } from "react";
import {
  Star, Heart, Truck, Phone, Mail, MapPin, Check, ShieldCheck, Clock, Gift, ShoppingBag, Sparkles, Smartphone, MessageCircle,
  Award, Leaf, Zap, ThumbsUp, Package, CreditCard, Instagram, Facebook, ArrowRight, Plus, ImageIcon, PlayCircle, Search, Menu, X,
} from "lucide-react";
import { safeHref, safeImage, type Condition, type Device, type LayoutNode, type ResponsiveStyle } from "@/lib/editor/schema";
import { effectiveStyle } from "@/lib/editor/nodes";
import { twClasses } from "@/lib/editor/tailwind";
import { useCart } from "./cart";
import { buildCss, buildPlainCss, type Rule } from "./style-css";
import { href, type StorefrontCtx, type StorefrontProduct } from "./types";
import { pickProducts } from "./product-select";
import { formatMoney } from "@/lib/money";
import { Editable, InlineEditProvider } from "./inline-edit";
import { WorkflowRunContext } from "./workflow-context";

// Renders custom-layout node trees (Section.nodes) for both the public store
// and the editor canvas. Each node is a div with class n-<id>; one <style>
// per tree carries the generated responsive + conditional CSS for its nodes.

export const NODE_ICONS = {
  star: Star, heart: Heart, truck: Truck, phone: Phone, mail: Mail, "map-pin": MapPin, check: Check, shield: ShieldCheck,
  clock: Clock, gift: Gift, bag: ShoppingBag, sparkles: Sparkles, smartphone: Smartphone, chat: MessageCircle, award: Award,
  leaf: Leaf, zap: Zap, "thumbs-up": ThumbsUp, package: Package, card: CreditCard, instagram: Instagram, facebook: Facebook,
  "arrow-right": ArrowRight, plus: Plus,
} as const;

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);
export const BUTTON_VARIANTS = ["solid", "secondary", "outline", "light", "dark", "link"] as const;
const INPUT_TYPES = new Set(["text", "email", "tel", "number", "date", "url"]);

const s = (n: LayoutNode, k: string) => (typeof n.props[k] === "string" ? (n.props[k] as string) : "");
const num = (n: LayoutNode, k: string, d: number, min: number, max: number) => {
  const v = Number(n.props[k]);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
};
const field = (n: LayoutNode) => (/^[A-Za-z0-9_-]{1,40}$/.test(s(n, "name")) ? s(n, "name") : "field");
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ─── Editor hook-in ─────────────────────────────────────────────────────────

export type NodeBinding = {
  ref?: Ref<HTMLDivElement>;
  attrs?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>;
  className?: string;
  /** Overlay rendered inside the node (selection outline, handles, toolbar). */
  chrome?: ReactNode;
};

export type NodeEditApi = {
  /** Called once per rendered node — the editor attaches selection, dnd and handles. */
  useNode: (node: LayoutNode, parent: LayoutNode | null) => NodeBinding;
  /** `slot` is set for trees inside a header bar (see NodeSlotContext). */
  setProp: (nodeId: string, key: string, value: string | number | boolean, slot?: string) => void;
};

const NodeEditContext = createContext<NodeEditApi | null>(null);
export const NodeEditProvider = NodeEditContext.Provider;

/**
 * Names the element tree a node belongs to when one section holds several —
 * the header's information bar ("header") and navigation bar ("header-nav").
 * `axis` is the flow direction of the tree's top level (for drop indicators).
 */
export const NodeSlotContext = createContext<{ sectionId: string; axis: "x" | "y" } | null>(null);

const useNoBinding = (): NodeBinding => ({});

// ─── CSS ───────────────────────────────────────────────────────────────────

export function isBoxed(node: LayoutNode) {
  return node.type === "container" && node.props.contentWidth === "boxed";
}

function nodeRules(node: LayoutNode, base = `.n-${node.id}`): Rule[] {
  if (isBoxed(node)) return [{ sel: base, groups: ["outer", "skin"] }, { sel: `${base}>.sf-in`, groups: ["layout"] }];
  // Buttons: the box styles (padding, colours, radius…) belong on the button itself.
  if (node.type === "button" || node.type === "product-button") return [{ sel: base, groups: ["outer"] }, { sel: `${base}>.sf-btn`, groups: ["skin", "layout"] }];
  // Product grid: the gap / alignment belong on the grid of cards.
  if (node.type === "products") return [{ sel: base, groups: ["outer", "skin"] }, { sel: `${base}>.sf-grid`, groups: ["layout"] }];
  // Form fields & search: the box styles (border, radius, background, padding) shape the field itself.
  if (node.type === "input" || node.type === "textarea" || node.type === "select" || node.type === "search") {
    return [{ sel: base, groups: ["layout", "outer", "text"] }, { sel: `${base} .sf-input`, groups: ["box", "text"] }];
  }
  if (node.type === "menu") return [{ sel: base, groups: ["outer", "skin"] }, { sel: `${base} .sf-menu-items`, groups: ["layout"] }];
  return [{ sel: base, groups: ["layout", "outer", "skin"] }];
}

const DEVICE_WRAP: Record<Device, (body: string) => string> = {
  desktop: (b) => b,
  tablet: (b) => `@container (max-width:1024px){${b}}`,
  mobile: (b) => `@container (max-width:767px){${b}}`,
};

/**
 * "Push to start/end": an auto margin on the side that matches the parent's
 * flow direction on each device (a row on desktop may become a column on phones).
 */
function pushCss(n: LayoutNode, parentStyle: ResponsiveStyle | undefined): string {
  if (!(["desktop", "tablet", "mobile"] as const).some((d) => n.style?.[d]?.push)) return "";
  let css = "";
  for (const d of ["desktop", "tablet", "mobile"] as const) {
    const eff = effectiveStyle(n.style, d);
    const dir = effectiveStyle(parentStyle, d).direction ?? "column";
    const m = eff.margin;
    const sides = m ? [m.t, m.r, m.b, m.l].map((v) => `${Math.round(v)}${m.u}`) : ["0px", "0px", "0px", "0px"];
    if (eff.push) {
      const side: Record<string, [number, number]> = { row: [3, 1], "row-reverse": [1, 3], column: [0, 2], "column-reverse": [2, 0] };
      sides[side[dir][eff.push === "end" ? 0 : 1]] = "auto";
    }
    css += DEVICE_WRAP[d](`.n-${n.id}{margin:${sides.join(" ")}}`);
  }
  return css;
}

const FIELD_TYPES = new Set(["input", "textarea", "select", "search"]);
/** Fields have no border by default: a border given only a size gets a soft colour. */
function fieldBorderCss(n: LayoutNode): string {
  if (!FIELD_TYPES.has(n.type)) return "";
  const layers = [n.style?.desktop, n.style?.tablet, n.style?.mobile];
  if (!layers.some((l) => l?.borderWidth) || layers.some((l) => l?.borderColor)) return "";
  return `.n-${n.id} .sf-input{border-color:rgb(0 0 0 / .2)}`;
}

/** Product grid columns per device (props: columns / columnsTablet / columnsMobile). */
function gridCss(n: LayoutNode): string {
  if (n.type !== "products") return "";
  const cols = { desktop: num(n, "columns", 4, 1, 8), tablet: num(n, "columnsTablet", 3, 1, 8), mobile: num(n, "columnsMobile", 2, 1, 4) };
  return (["desktop", "tablet", "mobile"] as const).map((d) => DEVICE_WRAP[d](`.n-${n.id}>.sf-grid{grid-template-columns:repeat(${Math.round(cols[d])},minmax(0,1fr))}`)).join("");
}

/** Selector(s) that stand in for `.n-<id>` while a condition holds. */
function conditionSelector(when: Condition, nodeId: string): { sel: string; wrap?: string } {
  const base = `.n-${nodeId}`;
  switch (when.type) {
    case "hover": return { sel: `${base}:hover` };
    case "pressed": return { sel: `${base}:active` };
    case "focus": return { sel: `${base}:focus-within` };
    case "clicked": return { sel: `[data-sf-states~="${nodeId}"] ${base}` };
    case "state": return { sel: `[data-sf-states~="${when.nodeId}"] ${base}` };
    case "scrolled": return { sel: `[data-sf-scroll~="${Math.round(when.offset)}"] ${base}` };
    case "width": {
      const q = [when.min !== undefined && `(min-width:${Math.round(when.min)}px)`, when.max !== undefined && `(max-width:${Math.round(when.max)}px)`].filter(Boolean).join(" and ");
      return { sel: base, wrap: q ? `@container ${q}` : undefined };
    }
  }
}

function conditionsCss(n: LayoutNode, editing: boolean): string {
  let css = "";
  for (const c of n.conditions ?? []) {
    const { sel, wrap } = conditionSelector(c.when, n.id);
    // In the editor a condition can be previewed by flagging it on the canvas.
    const variants = editing ? [sel, `[data-sf-preview~="${c.id}"] .n-${n.id}`] : [sel];
    const base = `.n-${n.id}`;
    const rules = nodeRules(n).map((r) => ({ ...r, sel: variants.map((v) => r.sel.replace(base, v)).join(",") }));
    const body = buildPlainCss(c.style, rules, variants.join(","), editing);
    if (!body) continue;
    css += wrap ? `${wrap}{${body}}` : body;
  }
  return css;
}

/** `parentStyle`: the style of whatever holds the top level (decides push direction). */
export function treeCss(nodes: LayoutNode[], editing = false, parentStyle?: ResponsiveStyle): string {
  let css = "";
  const walk = (list: LayoutNode[], parent: ResponsiveStyle | undefined) => {
    for (const n of list) {
      css += fieldBorderCss(n);
      css += buildCss(n.style, nodeRules(n), `.n-${n.id}`, editing);
      css += pushCss(n, parent);
      css += gridCss(n);
      css += conditionsCss(n, editing);
      if (n.children) walk(n.children, n.style ?? { desktop: { direction: "column" } });
    }
  };
  walk(nodes, parentStyle);
  return css;
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function MaybeLink({ to, ctx, children, className }: { to: string; ctx: StorefrontCtx; children: ReactNode; className?: string }) {
  if (!to) return <>{children}</>;
  return <Link href={href(ctx, safeHref(to))} className={className}>{children}</Link>;
}

function Placeholder({ icon: Icon, text }: { icon: typeof ImageIcon; text: string }) {
  return (
    <div className="flex min-h-[140px] w-full flex-col items-center justify-center gap-2 bg-black/5 p-4 text-center text-xs opacity-70">
      <Icon className="h-6 w-6" /> {text}
    </div>
  );
}

function videoSrc(node: LayoutNode): string | null {
  const id = s(node, "videoId").trim();
  if (s(node, "provider") === "vimeo") return /^\d{5,12}$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** Elements whose custom Tailwind classes go on the inner button / field, not the outer box. */
const TW_INNER = new Set(["button", "product-button", "input", "textarea", "select"]);
const twOf = (n: LayoutNode) => twClasses(n.tw).join(" ");

function buttonClass(node: LayoutNode) {
  const variant = (BUTTON_VARIANTS as readonly string[]).includes(s(node, "variant")) ? s(node, "variant") : "solid";
  const size = ["sm", "lg"].includes(s(node, "size")) ? ` sf-btn-${s(node, "size")}` : "";
  const tw = twOf(node);
  return `sf-btn sf-btn-${variant}${size}${tw ? ` ${tw}` : ""}`;
}
const fieldClass = (n: LayoutNode) => cx("sf-input", twOf(n));

function Label({ node }: { node: LayoutNode }) {
  return (
    <span className="sf-label">
      <Editable k="label" value={s(node, "label")} />
      {node.props.required === true && <span aria-hidden> *</span>}
    </span>
  );
}

function FormNode({ node, ctx, children }: { node: LayoutNode; ctx: StorefrontCtx; children: ReactNode }) {
  const run = useContext(WorkflowRunContext);
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message?: string }>({ status: "idle" });
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ctx.editing || ctx.demo || !run) return;
    const form = e.currentTarget;
    setState({ status: "sending" });
    const res = await run.submit(node.id, form).catch(() => ({ ok: false, message: "Something went wrong. Please try again." }));
    setState(res.ok ? { status: "done", message: res.message ?? (s(node, "successMessage") || "Thank you!") } : { status: "error", message: res.message ?? "Something went wrong. Please try again." });
  }
  return (
    // display:contents — the wrapper div is the flex container, the form only collects fields.
    <form className="contents" onSubmit={onSubmit} aria-busy={state.status === "sending"} data-form-name={s(node, "formName") || "Form"}>
      {children}
      <input type="text" name="_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state.status === "done" || state.status === "error" ? (
        <p role="status" className={cx("sf-form-msg", state.status === "error" && "sf-form-error")}>{state.message}</p>
      ) : null}
    </form>
  );
}

/** Shifts an open popup sideways so it stays inside the window (phones). */
function useKeepInView(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    el.style.translate = "";
    const r = el.getBoundingClientRect();
    const pad = 8;
    const shift = r.left < pad ? pad - r.left : r.right > window.innerWidth - pad ? window.innerWidth - pad - r.right : 0;
    if (shift) el.style.translate = `${Math.round(shift)}px 0`;
  }, [open]);
  return ref;
}

/** "Label | /path" per line → links. */
function parseLinks(raw: string) {
  return raw.split("\n").map((l) => {
    const [label, to] = l.split("|").map((x) => x.trim());
    return { label: label ?? "", to: to || "/" };
  }).filter((l) => l.label).slice(0, 20);
}

function MenuNode({ node, ctx }: { node: LayoutNode; ctx: StorefrontCtx }) {
  const [open, setOpen] = useState(false);
  const drop = useKeepInView(open);
  const items = parseLinks(s(node, "links"));
  const mode = ["hamburger", "inline", "hidden"].includes(s(node, "mobile")) ? s(node, "mobile") : "hamburger";
  const links = (cls: string) => items.map((l, i) => <Link key={i} href={href(ctx, safeHref(l.to, "/"))} className={cls} onClick={() => setOpen(false)}>{l.label}</Link>);
  if (!items.length && ctx.editing) return <span className="text-xs opacity-60">Add menu links in the panel</span>;
  return (
    <nav className="sf-menu-nav" aria-label="Menu">
      <div className={cx("sf-menu-items", mode !== "inline" && "hidden @3xl:flex")}>{links("sf-menu-link")}</div>
      {mode === "hamburger" && (
        <button type="button" className="sf-menu-toggle @3xl:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      )}
      {mode === "hamburger" && open && <div ref={drop} className="sf-menu-drop @3xl:hidden">{links("sf-menu-drop-link")}</div>}
    </nav>
  );
}

function CartNode({ node, ctx }: { node: LayoutNode; ctx: StorefrontCtx }) {
  const { count } = useCart();
  const size = num(node, "size", 22, 12, 64);
  return (
    <Link href={href(ctx, "/cart")} className="sf-cart-link" aria-label={`Cart, ${count} items`}>
      <ShoppingBag style={{ width: size, height: size }} aria-hidden />
      {node.props.showCount !== false && count > 0 && <span className="sf-cart-count">{count}</span>}
    </Link>
  );
}

function SearchNode({ node, ctx }: { node: LayoutNode; ctx: StorefrontCtx }) {
  const [open, setOpen] = useState(false);
  const pop = useKeepInView(open);
  const form = (
    <form action={href(ctx, "/products")} method="get" role="search" className="sf-searchbar" onSubmit={ctx.editing || ctx.demo ? (e) => e.preventDefault() : undefined}>
      <span className="sf-search-field">
        <Search className="h-4 w-4 opacity-50" aria-hidden />
        <input name="q" type="search" className="sf-input" placeholder={s(node, "placeholder")} aria-label={s(node, "placeholder") || "Search"} autoFocus={open} />
      </span>
      {s(node, "buttonText") && <button type="submit" className="sf-btn sf-btn-solid">{s(node, "buttonText")}</button>}
    </form>
  );
  if (s(node, "variant") !== "icon") return form;
  return (
    <>
      <button type="button" className="sf-icon-btn" aria-label="Search" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Search className="h-5 w-5" /></button>
      {open && <div ref={pop} className="sf-search-pop">{form}</div>}
    </>
  );
}

// ─── Product grid ──────────────────────────────────────────────────────────

/** The product a grid card is repeating (read by the product-* elements). */
const ProductContext = createContext<StorefrontProduct | null>(null);

const SAMPLE_PRODUCT: StorefrontProduct = {
  id: "sample", name: "Product name", slug: "sample", price: 25000, compareAtPrice: null, image: null,
  categorySlug: null, featured: false, createdAt: 0, inStock: true, hasVariants: false,
};

/** Current card's product; in the editor, outside a grid, a stand-in so the element can be styled. */
function useProduct(ctx: StorefrontCtx): StorefrontProduct | null {
  const p = useContext(ProductContext);
  return p ?? (ctx.editing ? ctx.products[0] ?? SAMPLE_PRODUCT : null);
}

function ProductsNode({ node, ctx, empty }: { node: LayoutNode; ctx: StorefrontCtx; empty: ReactNode }) {
  const edit = useContext(NodeEditContext);
  const found = pickProducts({ source: s(node, "source"), category: s(node, "category"), sort: s(node, "sort"), limit: num(node, "limit", 8, 1, 24) }, ctx.products);
  const items = found.length ? found : ctx.editing ? [SAMPLE_PRODUCT] : [];
  const cards = node.children ?? [];
  if (!items.length) return <p className="sf-grid-empty">New products coming soon.</p>;
  return (
    <div className="sf-grid">
      {items.map((p, i) => (
        <ProductContext.Provider key={p.id} value={p}>
          <div className="sf-cell">
            {/* In the editor only the first card is editable; the rest mirror it. */}
            {i === 0 || !edit ? (
              cards.map((c) => <RenderNode key={c.id} node={c} parent={node} ctx={ctx} />)
            ) : (
              <NodeEditProvider value={null}>
                <InlineEditProvider value={null}>
                  <div className="contents" data-sf-mirror="">{cards.map((c) => <RenderNode key={c.id} node={c} parent={node} ctx={ctx} />)}</div>
                </InlineEditProvider>
              </NodeEditProvider>
            )}
            {i === 0 && empty}
          </div>
        </ProductContext.Provider>
      ))}
    </div>
  );
}

const RATIOS: Record<string, string> = { square: "1 / 1", portrait: "3 / 4", landscape: "4 / 3", tall: "2 / 3" };

function ProductImageNode({ node, ctx }: { node: LayoutNode; ctx: StorefrontCtx }) {
  const p = useProduct(ctx);
  if (!p) return null;
  const onSale = !!p.compareAtPrice && p.compareAtPrice > p.price;
  const ratio = RATIOS[s(node, "ratio")];
  const body = (
    <div className={cx("sf-pimg", node.props.zoom !== false && "sf-zoom")} style={ratio ? { aspectRatio: ratio } : undefined}>
      {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <span className="sf-pimg-none"><ImageIcon className="h-6 w-6" aria-hidden /></span>}
      {node.props.badges !== false && (!p.inStock ? <span className="sf-badge sf-badge-dark">Sold out</span> : onSale ? <span className="sf-badge">Sale</span> : null)}
    </div>
  );
  return node.props.link !== false ? <Link href={href(ctx, `/products/${p.slug}`)} aria-label={p.name}>{body}</Link> : body;
}

function ProductButtonNode({ node, ctx }: { node: LayoutNode; ctx: StorefrontCtx }) {
  const p = useProduct(ctx);
  const cart = useCart();
  const [added, setAdded] = useState(false);
  if (!p) return null;
  const page = href(ctx, `/products/${p.slug}`);
  const text = s(node, "text") || "Add to cart";
  if (s(node, "action") === "view" || p.hasVariants || !p.inStock) {
    const label = s(node, "action") === "view" ? text : !p.inStock ? "Sold out" : "Choose options";
    return <Link href={page} className={buttonClass(node)} aria-disabled={!p.inStock || undefined}>{label}</Link>;
  }
  return (
    <button
      type="button"
      className={buttonClass(node)}
      onClick={(e) => {
        if (ctx.editing || ctx.demo) return;
        // A number input named "quantity" in the same card sets how many.
        const qty = Number((e.currentTarget.closest(".sf-cell")?.querySelector('input[name="quantity"]') as HTMLInputElement | null)?.value);
        cart.add({ productId: p.id, variantId: null, name: p.name, variantName: null, price: p.price, image: p.image, quantity: Number.isFinite(qty) && qty > 0 ? Math.min(99, Math.round(qty)) : 1, slug: p.slug });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
    >
      {added ? "Added ✓" : text}
    </button>
  );
}

function ProductName({ node, ctx }: { node: LayoutNode; ctx: StorefrontCtx }) {
  const p = useProduct(ctx);
  if (!p) return null;
  return node.props.link !== false ? <Link href={href(ctx, `/products/${p.slug}`)} className="sf-pname">{p.name}</Link> : <span className="sf-pname">{p.name}</span>;
}

function ProductPrice({ node, ctx }: { node: LayoutNode; ctx: StorefrontCtx }) {
  const p = useProduct(ctx);
  if (!p) return null;
  const onSale = !!p.compareAtPrice && p.compareAtPrice > p.price;
  return (
    <span>
      {formatMoney(p.price, ctx.store.currency)}
      {onSale && node.props.compare !== false ? <s className="sf-compare">{formatMoney(p.compareAtPrice!, ctx.store.currency)}</s> : null}
    </span>
  );
}

function NodeContent({ node, ctx }: { node: LayoutNode; ctx: StorefrontCtx }) {
  const kids = () => (node.children ?? []).map((c) => <RenderNode key={c.id} node={c} parent={node} ctx={ctx} />);
  const empty = !node.children?.length && ctx.editing ? (
    <div className="flex min-h-[80px] w-full flex-1 items-center justify-center rounded border-2 border-dashed border-current/20 text-xs opacity-60">
      Drag elements here
    </div>
  ) : null;
  switch (node.type) {
    case "container":
      return isBoxed(node) ? <div className="sf-in">{kids()}{empty}</div> : <>{kids()}{empty}</>;
    case "form":
      return <FormNode node={node} ctx={ctx}>{kids()}{empty}</FormNode>;
    case "products":
      return <ProductsNode node={node} ctx={ctx} empty={empty} />;
    case "product-image":
      return <ProductImageNode node={node} ctx={ctx} />;
    case "product-name":
      return <ProductName node={node} ctx={ctx} />;
    case "product-price":
      return <ProductPrice node={node} ctx={ctx} />;
    case "product-button":
      return <ProductButtonNode node={node} ctx={ctx} />;
    case "heading": {
      const tag = (HEADING_TAGS.has(s(node, "tag")) ? s(node, "tag") : "h2") as "h2";
      return <MaybeLink to={s(node, "link")} ctx={ctx}><Editable as={tag} k="text" value={s(node, "text")} /></MaybeLink>;
    }
    case "text":
      return <Editable as="p" k="text" multiline value={s(node, "text")} className="whitespace-pre-line" />;
    case "image": {
      const src = safeImage(s(node, "src"));
      if (!src) return ctx.editing ? <Placeholder icon={ImageIcon} text="Choose an image in the panel" /> : null;
      const fit = ["cover", "contain", "fill"].includes(s(node, "fit")) ? s(node, "fit") : "cover";
      return <MaybeLink to={s(node, "link")} ctx={ctx}><img src={src} alt={s(node, "alt")} loading="lazy" style={{ objectFit: fit as "cover" }} /></MaybeLink>;
    }
    case "button":
      return s(node, "action") === "submit" ? (
        <button type="submit" className={buttonClass(node)}><Editable k="text" value={s(node, "text")} /></button>
      ) : (
        <Link href={href(ctx, safeHref(s(node, "link"), "/products"))} className={buttonClass(node)}>
          <Editable k="text" value={s(node, "text")} />
        </Link>
      );
    case "spacer":
      return null;
    case "divider":
      return <div className="sf-line" style={{ borderTopWidth: num(node, "thickness", 1, 1, 20) }} />;
    case "icon": {
      const Icon = NODE_ICONS[s(node, "icon") as keyof typeof NODE_ICONS] ?? Star;
      const size = num(node, "size", 32, 8, 200);
      return <Icon style={{ width: size, height: size }} aria-hidden />;
    }
    case "video": {
      const src = videoSrc(node);
      if (!src) return ctx.editing ? <Placeholder icon={PlayCircle} text="Paste a YouTube or Vimeo video ID in the panel" /> : null;
      return (
        <div className="sf-frame">
          <iframe src={src} title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" style={ctx.editing ? { pointerEvents: "none" } : undefined} />
        </div>
      );
    }
    case "search":
      return <SearchNode node={node} ctx={ctx} />;
    case "logo": {
      const img = safeImage(s(node, "image"));
      const name = s(node, "text") || ctx.store.name;
      return (
        <Link href={href(ctx, "/")} className="sf-logo-link">
          {img ? <img src={img} alt={name} style={{ height: num(node, "height", 36, 16, 160), width: "auto" }} /> : <Editable k="text" value={name} />}
        </Link>
      );
    }
    case "menu":
      return <MenuNode node={node} ctx={ctx} />;
    case "cart":
      return <CartNode node={node} ctx={ctx} />;
    case "input":
      return (
        <label className="sf-field">
          {s(node, "label") || ctx.editing ? <Label node={node} /> : null}
          <input className={fieldClass(node)} name={field(node)} type={INPUT_TYPES.has(s(node, "inputType")) ? s(node, "inputType") : "text"} placeholder={s(node, "placeholder")} required={node.props.required === true} maxLength={500} />
        </label>
      );
    case "textarea":
      return (
        <label className="sf-field">
          {s(node, "label") || ctx.editing ? <Label node={node} /> : null}
          <textarea className={fieldClass(node)} name={field(node)} rows={num(node, "rows", 4, 2, 20)} placeholder={s(node, "placeholder")} required={node.props.required === true} maxLength={2000} />
        </label>
      );
    case "select": {
      const options = s(node, "options").split(/\n|,/).map((o) => o.trim()).filter(Boolean).slice(0, 50);
      return (
        <label className="sf-field">
          {s(node, "label") || ctx.editing ? <Label node={node} /> : null}
          <select className={fieldClass(node)} name={field(node)} required={node.props.required === true} defaultValue="">
            <option value="" disabled>Choose…</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );
    }
    case "checkbox":
      return (
        <label className="sf-check">
          <input type="checkbox" name={field(node)} value="yes" required={node.props.required === true} />
          <Label node={node} />
        </label>
      );
  }
}

export function RenderNode({ node, parent, ctx }: { node: LayoutNode; parent: LayoutNode | null; ctx: StorefrontCtx }) {
  const edit = useContext(NodeEditContext);
  const slot = useContext(NodeSlotContext);
  const useBinding = edit?.useNode ?? useNoBinding;
  const { ref, attrs, className, chrome } = useBinding(node, parent);
  const content = <NodeContent node={node} ctx={ctx} />;
  const scrolls = (node.conditions ?? []).flatMap((c) => (c.when.type === "scrolled" ? [Math.round(c.when.offset)] : []));
  return (
    <div
      ref={ref}
      className={cx("sf-node", node.type === "input" ? "sf-input-el" : `sf-${node.type}`, `n-${node.id}`, !TW_INNER.has(node.type) && twOf(node), className)}
      data-nid={node.id}
      data-align={node.type === "button" || node.type === "product-button" ? s(node, "align") || undefined : undefined}
      // Read by the workflow runtime (components/storefront/workflow-runtime.tsx).
      data-sf-click={node.conditions?.some((c) => c.when.type === "clicked") ? "" : undefined}
      data-sf-scroll-at={scrolls.length ? scrolls.join(" ") : undefined}
      {...attrs}
    >
      {edit ? (
        <InlineEditProvider value={{ settings: node.props, onChange: (k, v) => typeof v !== "object" && v !== null && edit.setProp(node.id, k, v, slot?.sectionId) }}>
          {content}
        </InlineEditProvider>
      ) : content}
      {chrome}
    </div>
  );
}

export function NodeTree({ nodes, ctx, parentStyle }: { nodes: LayoutNode[]; ctx: StorefrontCtx; parentStyle?: ResponsiveStyle }) {
  const css = treeCss(nodes, !!ctx.editing, parentStyle);
  return (
    <>
      {/* Generated only from schema-validated values — see style-css.ts. */}
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {nodes.map((n) => <RenderNode key={n.id} node={n} parent={null} ctx={ctx} />)}
    </>
  );
}
