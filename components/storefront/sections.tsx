/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { Menu, Search, ShoppingBag, X, Phone, Mail, MapPin, MessageCircle, Clock, Truck, ShieldCheck, Smartphone, Instagram, Facebook } from "lucide-react";
import type { ResponsiveStyle, Section } from "@/lib/editor/schema";
import { safeHref, safeImage } from "@/lib/editor/schema";
import { bool, list, num, str } from "@/lib/editor/sections";
import { formatMoney } from "@/lib/money";
import { PAD, contrastText } from "./theme";
import { href, type StorefrontCtx, type StorefrontProduct } from "./types";
import { useCart } from "./cart";
import { Editable } from "./inline-edit";
import { NodeSlotContext, NodeTree } from "./nodes";
import { buildCss, cssUrl } from "./style-css";
import { pickProducts } from "./product-select";
import { twClasses } from "@/lib/editor/tailwind";

type Props = { section: Section; ctx: StorefrontCtx };

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const alignCls = (a: string) => (a === "left" ? "text-left items-start" : a === "right" ? "text-right items-end" : "text-center items-center");

function Wrap({ section, children, className, style }: { section: Section; children: ReactNode; className?: string; style?: CSSProperties }) {
  const bg = str(section, "backgroundColor");
  const fg = str(section, "textColor");
  return (
    <section
      className={cx(PAD[str(section, "paddingY")] ?? PAD.md, className)}
      style={{ ...(bg ? { background: bg } : {}), ...(fg ? { color: fg } : {}), ...style }}
    >
      {children}
    </section>
  );
}

const Container = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx("mx-auto w-full max-w-6xl px-4 @2xl:px-6", className)}>{children}</div>
);

function Heading({ text, k = "heading", ctx, className }: { text: string; k?: string; ctx?: StorefrontCtx; className?: string }) {
  if (!text && !ctx?.editing) return null;
  return <Editable as="h2" k={k} value={text} className={cx("text-2xl font-semibold tracking-tight @2xl:text-3xl", className)} style={{ fontFamily: "var(--sf-heading)" }} />;
}

export function SfButton({ text, to, ctx, variant = "solid", className, k = "buttonText" }: { text: string; to: string; ctx: StorefrontCtx; variant?: "solid" | "outline" | "light"; className?: string; k?: string }) {
  if (!text) return null;
  const styles: Record<string, CSSProperties> = {
    solid: { background: "var(--sf-primary)", color: contrastText(ctx.theme.primaryColor), borderColor: "var(--sf-primary)" },
    outline: { borderColor: "currentColor" },
    light: { background: "#ffffff", color: "#111111", borderColor: "#ffffff" },
  };
  const target = safeHref(to, "/products");
  return (
    <Link
      href={href(ctx, target)}
      className={cx("inline-flex items-center justify-center border px-6 py-3 text-sm font-semibold transition hover:opacity-90", className)}
      style={{ ...styles[variant], borderRadius: "var(--sf-radius-btn)" }}
    >
      <Editable k={k} value={text} />
    </Link>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function CartLink({ ctx }: { ctx: StorefrontCtx }) {
  const { count } = useCart();
  return (
    <Link href={href(ctx, "/cart")} className="relative inline-flex h-10 w-10 items-center justify-center" aria-label={`Cart, ${count} items`}>
      <ShoppingBag className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold" style={{ background: "var(--sf-primary)", color: contrastText(ctx.theme.primaryColor) }}>
          {count}
        </span>
      )}
    </Link>
  );
}

const TOP_SLOT = { sectionId: "header", axis: "y" as const };
const NAV_SLOT = { sectionId: "header-nav", axis: "x" as const };
const BAR_SLOT = { sectionId: "header-bar", axis: "y" as const };
const ROW: ResponsiveStyle = { desktop: { direction: "row" } };

export function HeaderSection({ section, ctx }: Props) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const style = str(section, "style");
  const preset: CSSProperties =
    style === "dark" ? { background: "#0b0b0c", color: "#fafafa" } : style === "brand" ? { background: "var(--sf-primary)", color: contrastText(ctx.theme.primaryColor) } : { background: "var(--sf-bg)", color: "var(--sf-text)" };
  const colors: CSSProperties = {
    ...preset,
    ...(str(section, "backgroundColor") ? { background: str(section, "backgroundColor") } : {}),
    ...(str(section, "textColor") ? { color: str(section, "textColor") } : {}),
  };
  const customBar = str(section, "topBarMode") === "custom";
  const topBar = bool(section, "topBar") && (customBar ? !!section.nodes?.length || ctx.editing : str(section, "topBarText") || ctx.editing);
  const topBarLink = str(section, "topBarLink");
  const topBarImage = cssUrl(str(section, "topBarImage"));
  const dim = Math.min(80, Math.max(0, num(section, "topBarOverlay", 30))) / 100;
  const links = list(section, "links");
  const logo = safeImage(str(section, "logoImage"));
  const name = str(section, "logoText") || ctx.store.name;

  // Layout: logo left or centred; links next to the logo, centred, or on the right.
  const logoCenter = str(section, "logoPosition") === "center";
  const linksPos = (["left", "center", "right"] as const).find((p) => p === str(section, "linksPosition")) ?? "left";
  const gap = { sm: "gap-4", md: "gap-6", lg: "gap-10", xl: "gap-14" }[str(section, "linksGap")] ?? "gap-6";
  const size = { sm: "text-sm", md: "text-base", lg: "text-lg" }[str(section, "linkSize")] ?? "text-sm";
  const height = Math.min(140, Math.max(48, num(section, "navHeight", 64)));

  const menuButton = (
    <button className="-ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center @3xl:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
      {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );
  const logoEl = (
    <Link href={href(ctx, "/")} className="flex min-w-0 shrink-0 items-center gap-2">
      {logo ? <img src={logo} alt={name} className="h-9 w-auto max-w-[160px] object-contain" /> : <Editable k="logoText" value={name} className="truncate text-lg font-bold tracking-tight" style={{ fontFamily: "var(--sf-heading)" }} />}
    </Link>
  );
  const showLinks = section.settings.showLinks !== false;
  const custom = bool(section, "navElements") && (!!section.navNodes?.length || ctx.editing);
  const customPos = (["left", "center", "right"] as const).find((p) => p === str(section, "navElementsPosition")) ?? "right";
  // The merchant's own elements in the bar (a node tree like a custom section).
  const mine = (className?: string) => custom ? (
    <div className={cx("sf-nav-slot flex min-w-0 items-center", className)}>
      <NodeSlotContext.Provider value={NAV_SLOT}>
        {section.navNodes?.length ? <NodeTree nodes={section.navNodes} ctx={ctx} parentStyle={ROW} /> : <span className="rounded border border-dashed border-current/30 px-2 py-1 text-xs opacity-60">Your elements</span>}
      </NodeSlotContext.Provider>
    </div>
  ) : null;
  const nav = (className?: string) => !showLinks ? null : (
    <nav className={cx("hidden shrink-0 items-center whitespace-nowrap font-medium @3xl:flex", gap, size, bool(section, "linksUppercase") && "uppercase tracking-wide", className)}>
      {links.map((l, i) => (
        <Link key={i} href={href(ctx, safeHref(l.href, "/"))} className="opacity-80 transition hover:opacity-100"><Editable k="links" item={i} field="label" value={String(l.label ?? "")} /></Link>
      ))}
    </nav>
  );
  const icons = (
    <div className="flex shrink-0 items-center gap-1">
      {bool(section, "showSearch") && (
        <button className="inline-flex h-10 w-10 items-center justify-center" onClick={() => setSearching((s) => !s)} aria-label="Search">
          <Search className="h-5 w-5" />
        </button>
      )}
      {bool(section, "showCart") && <CartLink ctx={ctx} />}
    </div>
  );

  return (
    <header className={cx("z-30 border-b border-black/5", bool(section, "sticky") && !ctx.editing && "sticky top-0")} style={colors}>
      {topBar && (customBar ? (
        // Custom layout: a container tree designed in the editor (images, buttons, columns…).
        <div className="sf-topbar sf-custom">
          <NodeSlotContext.Provider value={TOP_SLOT}>
            {section.nodes?.length ? <NodeTree nodes={section.nodes} ctx={ctx} /> : (
              <div className="px-4 py-3 text-center text-xs opacity-70">Drag elements here from the left panel</div>
            )}
          </NodeSlotContext.Provider>
        </div>
      ) : (
        <div
          className="sf-topbar px-4 py-2 text-center text-xs font-medium @2xl:text-sm"
          style={{
            backgroundColor: str(section, "topBarBg") || "var(--sf-primary)",
            color: str(section, "topBarColor") || contrastText(ctx.theme.primaryColor),
            ...(topBarImage ? { backgroundImage: `linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})),${topBarImage}`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
          }}
        >
          {topBarLink ? <Link href={href(ctx, safeHref(topBarLink))} className="hover:underline"><Editable k="topBarText" value={str(section, "topBarText")} /></Link> : <Editable k="topBarText" value={str(section, "topBarText")} />}
        </div>
      ))}
      {str(section, "navMode") === "custom" ? (
        // Fully custom bar: a layout of elements (Logo, Menu, Search, Cart, buttons…).
        <div className="sf-navbar sf-custom">
          <NodeSlotContext.Provider value={BAR_SLOT}>
            {section.barNodes?.length ? <NodeTree nodes={section.barNodes} ctx={ctx} /> : (
              <div className="px-4 py-5 text-center text-xs opacity-60">{ctx.editing ? "Drag elements here from the left panel" : null}</div>
            )}
          </NodeSlotContext.Provider>
        </div>
      ) : logoCenter ? (
        <Container className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex min-w-0 items-center gap-4" style={{ height }}>{menuButton}{linksPos !== "right" && nav(linksPos === "center" ? "justify-center flex-1" : "")}{customPos !== "right" && mine()}</div>
          {logoEl}
          <div className="flex min-w-0 items-center justify-end gap-4">{linksPos === "right" && nav("justify-end")}{customPos === "right" && mine()}{icons}</div>
        </Container>
      ) : (
        <Container className="flex items-center gap-4">
          <div className="flex shrink-0 items-center gap-2" style={{ height }}>{menuButton}{logoEl}</div>
          {customPos === "left" && mine("ml-4")}
          {nav(linksPos === "left" ? "ml-6" : linksPos === "center" ? "flex-1 justify-center" : "ml-auto justify-end")}
          {customPos === "center" && mine(cx("justify-center", !(showLinks && linksPos === "center") && "flex-1"))}
          {/* Links hide on phones, so what follows keeps its own auto margin there. */}
          <div className={cx("flex items-center gap-3", showLinks && linksPos === "right" ? "ml-auto @3xl:ml-0" : customPos === "center" ? "" : "ml-auto")}>
            {customPos === "right" && mine()}
            {icons}
          </div>
        </Container>
      )}
      {searching && (
        <Container className="pb-3">
          <form action={href(ctx, "/products")} method="get">
            <input name="q" autoFocus placeholder="Search products…" className="w-full border-0 bg-white/90 px-4 py-2.5 text-sm text-zinc-900 outline-none" style={{ borderRadius: "var(--sf-radius)" }} />
          </form>
        </Container>
      )}
      {open && (
        <nav className="border-t border-black/5 @3xl:hidden">
          <Container className="flex flex-col py-2">
            {links.map((l, i) => (
              <Link key={i} href={href(ctx, safeHref(l.href, "/"))} className="py-3 text-base font-medium" onClick={() => setOpen(false)}>{String(l.label ?? "")}</Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}

// ─── Content sections ───────────────────────────────────────────────────────

export function AnnouncementSection({ section, ctx }: Props) {
  const text = str(section, "text");
  if (!text) return null;
  const link = str(section, "link");
  const inner = <p className="px-4 py-2 text-center text-xs font-medium @2xl:text-sm"><Editable k="text" value={text} /></p>;
  return (
    <div style={{ background: str(section, "backgroundColor") || "var(--sf-primary)", color: str(section, "textColor") || "#fff" }}>
      {link ? <Link href={href(ctx, safeHref(link))}>{inner}</Link> : inner}
    </div>
  );
}

const HERO_H: Record<string, string> = { sm: "min-h-[280px]", md: "min-h-[420px]", lg: "min-h-[560px]", full: "min-h-[88vh]" };

export function HeroSection({ section, ctx }: Props) {
  const image = safeImage(str(section, "backgroundImage"));
  const a = str(section, "align");
  const layout = str(section, "layout");
  const heading = str(section, "heading");
  const sub = str(section, "subheading");
  const fg = str(section, "textColor");

  if (layout === "split") {
    return (
      <section style={{ background: str(section, "backgroundColor") || "var(--sf-secondary)", color: fg || "var(--sf-text)" }}>
        <Container className="grid items-center gap-8 py-10 @3xl:grid-cols-2 @3xl:py-16">
          <div className={cx("flex flex-col gap-5", alignCls(a))}>
            <Editable as="h1" k="heading" value={heading} className="text-4xl font-bold leading-tight tracking-tight @2xl:text-5xl" style={{ fontFamily: "var(--sf-heading)" }} />
            {(sub || ctx.editing) && <Editable as="p" k="subheading" multiline value={sub} className="max-w-lg whitespace-pre-line text-base opacity-80 @2xl:text-lg" />}
            <SfButton text={str(section, "buttonText")} to={str(section, "buttonLink")} ctx={ctx} />
          </div>
          <div className="aspect-[4/3] overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}>
            {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-black/10" />}
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section
      className={cx("relative flex overflow-hidden", HERO_H[str(section, "height")] ?? HERO_H.lg)}
      style={{ background: str(section, "backgroundColor") || "#27272a", color: fg || "#ffffff" }}
    >
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {image && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${num(section, "overlay", 30) / 100})` }} />}
      <Container className={cx("relative flex flex-col justify-center gap-5 py-16", alignCls(a))}>
        <Editable as="h1" k="heading" value={heading} className="max-w-3xl text-4xl font-bold leading-tight tracking-tight @2xl:text-6xl" style={{ fontFamily: "var(--sf-heading)" }} />
        {(sub || ctx.editing) && <Editable as="p" k="subheading" multiline value={sub} className="max-w-xl whitespace-pre-line text-base opacity-90 @2xl:text-lg" />}
        <SfButton text={str(section, "buttonText")} to={str(section, "buttonLink")} ctx={ctx} variant={image ? "light" : "solid"} />
      </Container>
    </section>
  );
}

const FEATURE_ICONS = [Truck, Smartphone, ShieldCheck];

export function FeaturesSection({ section }: Props) {
  const items = list(section, "items");
  if (!items.length) return null;
  return (
    <Wrap section={section} className="border-y border-black/5">
      <Container className="grid gap-6 @2xl:grid-cols-3">
        {items.map((it, i) => {
          const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
          return (
            <div key={i} className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center" style={{ background: "var(--sf-secondary)", color: "var(--sf-primary)", borderRadius: "var(--sf-radius)" }}>
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <Editable as="p" k="items" item={i} field="title" value={String(it.title ?? "")} className="font-semibold" />
                <Editable as="p" k="items" item={i} field="text" value={String(it.text ?? "")} className="text-sm opacity-70" />
              </div>
            </div>
          );
        })}
      </Container>
    </Wrap>
  );
}

export function TextSection({ section, ctx }: Props) {
  return (
    <Wrap section={section}>
      <Container className={cx("flex max-w-3xl flex-col gap-4", alignCls(str(section, "align")))}>
        <Heading text={str(section, "heading")} ctx={ctx} />
        <Editable as="p" k="body" multiline value={str(section, "body")} className="whitespace-pre-line text-base leading-relaxed opacity-80" />
      </Container>
    </Wrap>
  );
}

export function ImageSection({ section, ctx }: Props) {
  const image = safeImage(str(section, "image"));
  const link = str(section, "link");
  const full = bool(section, "fullWidth");
  const img = image ? (
    <img src={image} alt={str(section, "alt")} className="w-full object-cover" style={{ borderRadius: full ? 0 : "var(--sf-radius)", maxHeight: 640 }} />
  ) : ctx.editing ? (
    <div className="flex aspect-[16/7] w-full items-center justify-center bg-black/5 text-sm opacity-60">Choose an image in the settings panel</div>
  ) : null;
  if (!img) return null;
  return (
    <Wrap section={section}>
      <div className={full ? "" : "mx-auto max-w-6xl px-4 @2xl:px-6"}>
        {link ? <Link href={href(ctx, safeHref(link))}>{img}</Link> : img}
        {(str(section, "caption") || ctx.editing) && <Editable as="p" k="caption" value={str(section, "caption")} className="mt-3 block text-center text-sm opacity-70" />}
      </div>
    </Wrap>
  );
}

const COLS: Record<string, string> = { "2": "@2xl:grid-cols-2", "3": "@2xl:grid-cols-2 @5xl:grid-cols-3", "4": "@2xl:grid-cols-3 @5xl:grid-cols-4", "5": "@2xl:grid-cols-3 @5xl:grid-cols-5", "6": "@2xl:grid-cols-3 @5xl:grid-cols-6" };

export function GallerySection({ section, ctx }: Props) {
  // Keep each image's index in the full list so inline caption edits hit the right item.
  const images = list(section, "images").map((img, i) => ({ img, i })).filter(({ img }) => safeImage(img.image));
  return (
    <Wrap section={section}>
      <Container className="flex flex-col gap-8">
        <Heading text={str(section, "heading")} ctx={ctx} className="text-center" />
        {images.length ? (
          <div className={cx("grid grid-cols-2 gap-3", COLS[str(section, "columns")] ?? COLS["3"])}>
            {images.map(({ img, i }) => (
              <figure key={i} className="overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}>
                <img src={safeImage(img.image)!} alt={String(img.caption ?? "")} className="aspect-square w-full object-cover transition duration-500 hover:scale-105" />
                {img.caption ? <Editable as="figcaption" k="images" item={i} field="caption" value={String(img.caption)} className="mt-2 block text-sm opacity-70" /> : null}
              </figure>
            ))}
          </div>
        ) : ctx.editing ? (
          <p className="text-center text-sm opacity-60">Add images in the settings panel.</p>
        ) : null}
      </Container>
    </Wrap>
  );
}

// ─── Commerce sections ──────────────────────────────────────────────────────

const RATIO: Record<string, string> = { square: "aspect-square", portrait: "aspect-[3/4]", landscape: "aspect-[4/3]" };

function CardAddButton({ product, ctx }: { product: StorefrontProduct; ctx: StorefrontCtx }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const cls = "inline-flex w-full items-center justify-center px-4 py-2 text-xs font-semibold transition hover:opacity-90";
  const style = { background: "var(--sf-primary)", color: "var(--sf-on-primary)", borderRadius: "var(--sf-radius-btn)" };
  if (product.hasVariants || !product.inStock) {
    return <Link href={href(ctx, `/products/${product.slug}`)} className={cx(cls, !product.inStock && "pointer-events-none opacity-50")} style={style}>{product.inStock ? "Choose options" : "Sold out"}</Link>;
  }
  return (
    <button type="button" className={cls} style={style} onClick={() => {
      if (ctx.editing || ctx.demo) return;
      add({ productId: product.id, variantId: null, name: product.name, variantName: null, price: product.price, image: product.image, quantity: 1, slug: product.slug });
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    }}>{added ? "Added ✓" : "Add to cart"}</button>
  );
}

export function ProductCard({ product, ctx, ratio = "square", align = "left", button = false }: { product: StorefrontProduct; ctx: StorefrontCtx; ratio?: string; align?: string; button?: boolean }) {
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price;
  const to = href(ctx, `/products/${product.slug}`);
  return (
    <div className={cx("group flex flex-col gap-3", align === "center" && "items-center text-center")}>
      <Link href={to} className={cx("relative block w-full overflow-hidden bg-black/5", RATIO[ratio] ?? RATIO.square)} style={{ borderRadius: "var(--sf-radius)" }}>
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs opacity-50">No image</div>
        )}
        {onSale ? <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-red-600">Sale</span> : null}
        {!product.inStock ? <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white">Sold out</span> : null}
      </Link>
      <div className="flex w-full flex-col gap-0.5">
        <Link href={to} className="line-clamp-2 text-sm font-medium">{product.name}</Link>
        <p className="text-sm">
          <span className="font-semibold">{formatMoney(product.price, ctx.store.currency)}</span>
          {onSale ? <span className="ml-2 text-xs line-through opacity-50">{formatMoney(product.compareAtPrice!, ctx.store.currency)}</span> : null}
        </p>
      </div>
      {button && <CardAddButton product={product} ctx={ctx} />}
    </div>
  );
}

export function selectProducts(section: Section, products: StorefrontProduct[]) {
  return pickProducts({ source: str(section, "source"), category: str(section, "category"), sort: str(section, "sort"), limit: num(section, "limit", 8) }, products);
}

export function ProductGridSection({ section, ctx }: Props) {
  const items = selectProducts(section, ctx.products);
  const cat = str(section, "category");
  return (
    <Wrap section={section}>
      <Container className="flex flex-col gap-8">
        <div className="flex items-end justify-between gap-4">
          <Heading text={str(section, "heading")} ctx={ctx} />
          {bool(section, "showViewAll") && (
            <Link href={href(ctx, str(section, "source") === "category" && cat ? `/collections/${cat}` : "/products")} className="shrink-0 text-sm font-medium underline underline-offset-4">
              View all
            </Link>
          )}
        </div>
        {items.length ? (
          <div className={cx("grid grid-cols-2 gap-x-4 gap-y-8", COLS[str(section, "columns")] ?? COLS["4"])}>
            {items.map((p) => <ProductCard key={p.id} product={p} ctx={ctx} ratio={str(section, "imageRatio")} align={str(section, "cardAlign")} button={bool(section, "cardButton")} />)}
          </div>
        ) : (
          <p className="rounded border border-dashed border-current/20 p-8 text-center text-sm opacity-60">
            {ctx.editing ? "Products you add in the dashboard will appear here." : "New products coming soon."}
          </p>
        )}
      </Container>
    </Wrap>
  );
}

export function CategoriesSection({ section, ctx }: Props) {
  const cats = ctx.categories;
  if (!cats.length && !ctx.editing) return null;
  const pills = str(section, "style") === "pills";
  return (
    <Wrap section={section}>
      <Container className="flex flex-col gap-8">
        <Heading text={str(section, "heading")} ctx={ctx} className={pills ? "" : "text-center"} />
        {!cats.length ? (
          <p className="text-center text-sm opacity-60">Create categories in the dashboard to show them here.</p>
        ) : pills ? (
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <Link key={c.id} href={href(ctx, `/collections/${c.slug}`)} className="border border-current/15 px-4 py-2 text-sm font-medium transition hover:border-current/40" style={{ borderRadius: "var(--sf-radius-btn)", background: "var(--sf-secondary)" }}>
                {c.name}
              </Link>
            ))}
          </div>
        ) : (
          <div className={cx("grid grid-cols-2 gap-4", COLS[str(section, "columns")] ?? COLS["4"])}>
            {cats.map((c) => (
              <Link key={c.id} href={href(ctx, `/collections/${c.slug}`)} className="group relative aspect-[4/5] overflow-hidden bg-black/10" style={{ borderRadius: "var(--sf-radius)" }}>
                {safeImage(c.imageUrl) && <img src={safeImage(c.imageUrl)!} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-4 left-4 text-lg font-semibold text-white">{c.name}</span>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </Wrap>
  );
}

export function PromoBannerSection({ section, ctx }: Props) {
  const image = safeImage(str(section, "image"));
  return (
    <Wrap section={section}>
      <Container>
        <div className={cx("grid overflow-hidden", image && "@3xl:grid-cols-2")} style={{ borderRadius: "var(--sf-radius)", background: str(section, "backgroundColor") ? undefined : "var(--sf-secondary)" }}>
          <div className="flex flex-col items-start justify-center gap-4 p-8 @2xl:p-12">
            <Heading text={str(section, "heading")} ctx={ctx} />
            {(str(section, "text") || ctx.editing) && <Editable as="p" k="text" multiline value={str(section, "text")} className="whitespace-pre-line opacity-80" />}
            <SfButton text={str(section, "buttonText")} to={str(section, "buttonLink")} ctx={ctx} />
          </div>
          {image && <img src={image} alt="" className="h-full min-h-[240px] w-full object-cover" />}
        </div>
      </Container>
    </Wrap>
  );
}

export function TestimonialsSection({ section, ctx }: Props) {
  const items = list(section, "items");
  return (
    <Wrap section={section}>
      <Container className="flex flex-col gap-8">
        <Heading text={str(section, "heading")} ctx={ctx} className="text-center" />
        <div className="grid gap-4 @3xl:grid-cols-3">
          {items.map((t, i) => (
            <figure key={i} className="flex flex-col gap-4 border border-current/10 p-6" style={{ borderRadius: "var(--sf-radius)" }}>
              <blockquote className="text-base leading-relaxed">“<Editable k="items" item={i} field="quote" multiline value={String(t.quote ?? "")} />”</blockquote>
              <figcaption className="text-sm">
                <Editable k="items" item={i} field="author" value={String(t.author ?? "")} className="font-semibold" />
                {t.role || ctx.editing ? <span className="opacity-60"> · <Editable k="items" item={i} field="role" value={String(t.role ?? "")} /></span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </Wrap>
  );
}

export function NewsletterSection({ section, ctx }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ctx.editing || ctx.demo) return;
    const email = new FormData(e.currentTarget).get("email");
    setState("sending");
    const res = await fetch("/api/storefront/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId: ctx.store.id, email }) });
    setState(res.ok ? "done" : "error");
  }
  return (
    <Wrap section={section} style={str(section, "backgroundColor") ? undefined : { background: "var(--sf-secondary)" }}>
      <Container className="flex max-w-xl flex-col items-center gap-4 text-center">
        <Heading text={str(section, "heading")} ctx={ctx} />
        <Editable as="p" k="text" multiline value={str(section, "text")} className="whitespace-pre-line opacity-80" />
        {state === "done" ? (
          <p className="font-medium">Thank you — you are subscribed.</p>
        ) : (
          <form onSubmit={submit} className="flex w-full flex-col gap-2 @2xl:flex-row">
            <input required type="email" name="email" placeholder="you@example.com" className="min-w-0 flex-1 border-0 bg-white px-4 py-3 shadow-sm text-sm text-zinc-900 outline-none" style={{ borderRadius: "var(--sf-radius-btn)" }} />
            <button disabled={state === "sending"} className="px-6 py-3 text-sm font-semibold" style={{ background: "var(--sf-primary)", color: contrastText(ctx.theme.primaryColor), borderRadius: "var(--sf-radius-btn)" }}>
              {str(section, "buttonText") || "Subscribe"}
            </button>
          </form>
        )}
        {state === "error" && <p className="text-sm text-red-600">Something went wrong. Please try again.</p>}
      </Container>
    </Wrap>
  );
}

export function ContactSection({ section, ctx }: Props) {
  const { phone, email, location } = ctx.store;
  const wa = phone?.replace(/[^\d]/g, "");
  const rows: { icon: typeof Phone; label: string; value: string; link?: string }[] = [];
  if (bool(section, "showPhone") && phone) rows.push({ icon: Phone, label: "Phone", value: phone, link: `tel:${phone}` });
  if (bool(section, "showEmail") && email) rows.push({ icon: Mail, label: "Email", value: email, link: `mailto:${email}` });
  if (bool(section, "showLocation") && location) rows.push({ icon: MapPin, label: "Location", value: location });
  if (str(section, "hours")) rows.push({ icon: Clock, label: "Opening hours", value: str(section, "hours") });
  return (
    <Wrap section={section}>
      <Container className="grid gap-10 @3xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Heading text={str(section, "heading")} ctx={ctx} />
          <Editable as="p" k="text" multiline value={str(section, "text")} className="whitespace-pre-line opacity-80" />
          {bool(section, "showWhatsApp") && wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-2 bg-[#25D366] px-5 py-3 text-sm font-semibold text-white" style={{ borderRadius: "var(--sf-radius-btn)" }}>
              <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
            </a>
          )}
        </div>
        <ul className="flex flex-col gap-4">
          {rows.map((r) => (
            <li key={r.label} className="flex items-start gap-3">
              <r.icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sf-primary)" }} />
              <div>
                <p className="text-xs uppercase tracking-wide opacity-60">{r.label}</p>
                {r.link ? <a href={r.link} className="font-medium">{r.value}</a> : <p className="font-medium">{r.value}</p>}
              </div>
            </li>
          ))}
          {!rows.length && ctx.editing && <li className="text-sm opacity-60">Add your phone, email and location in Store settings.</li>}
        </ul>
      </Container>
    </Wrap>
  );
}

export function ButtonSection({ section, ctx }: Props) {
  return (
    <Wrap section={section}>
      <Container className={cx("flex flex-col", alignCls(str(section, "align")))}>
        <SfButton k="text" text={str(section, "text")} to={str(section, "link")} ctx={ctx} variant={str(section, "style") === "outline" ? "outline" : "solid"} />
      </Container>
    </Wrap>
  );
}

export function SpacerSection({ section }: Props) {
  return <div style={{ height: num(section, "height", 48), background: str(section, "backgroundColor") || undefined }} />;
}

export function FooterSection({ section, ctx }: Props) {
  const links = list(section, "links");
  const social = [
    { key: "instagram", Icon: Instagram, label: "Instagram" },
    { key: "facebook", Icon: Facebook, label: "Facebook" },
  ].filter((s) => /^https:\/\//.test(str(section, s.key)));
  const extra = [
    { key: "tiktok", label: "TikTok" },
    { key: "x", label: "X" },
  ].filter((s) => /^https:\/\//.test(str(section, s.key)));
  const wa = str(section, "whatsapp").replace(/[^\d]/g, "");
  return (
    <footer style={{ background: str(section, "backgroundColor") || "#111", color: str(section, "textColor") || "#e4e4e7" }}>
      <Container className="grid gap-8 py-12 @3xl:grid-cols-3">
        <div className="flex flex-col gap-3">
          <p className="text-lg font-bold" style={{ fontFamily: "var(--sf-heading)" }}>{ctx.store.name}</p>
          <Editable as="p" k="text" multiline value={str(section, "text")} className="whitespace-pre-line text-sm opacity-75" />
        </div>
        <nav className="flex flex-col gap-2 text-sm">
          {links.map((l, i) => (
            <Link key={i} href={href(ctx, safeHref(l.href, "/"))} className="opacity-80 hover:opacity-100"><Editable k="links" item={i} field="label" value={String(l.label ?? "")} /></Link>
          ))}
        </nav>
        <div className="flex flex-col gap-3 text-sm">
          {ctx.store.phone && <a href={`tel:${ctx.store.phone}`} className="opacity-80">{ctx.store.phone}</a>}
          {ctx.store.email && <a href={`mailto:${ctx.store.email}`} className="opacity-80">{ctx.store.email}</a>}
          <div className="flex items-center gap-3">
            {social.map(({ key, Icon, label }) => (
              <a key={key} href={str(section, key)} target="_blank" rel="noopener noreferrer" aria-label={label} className="opacity-80 hover:opacity-100"><Icon className="h-5 w-5" /></a>
            ))}
            {extra.map(({ key, label }) => (
              <a key={key} href={str(section, key)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold opacity-80 hover:opacity-100">{label}</a>
            ))}
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="opacity-80 hover:opacity-100"><MessageCircle className="h-5 w-5" /></a>}
          </div>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-1 py-4 text-xs opacity-60 @2xl:flex-row @2xl:justify-between">
          <span>© {new Date().getFullYear()} {ctx.store.name}. All rights reserved.</span>
          <span>Powered by StoreHub Rwanda</span>
        </Container>
      </div>
    </footer>
  );
}

/** The real content of a built-in shop page, handed in by its route. */
export const SystemSlotContext = createContext<ReactNode>(null);

const SYSTEM_PREVIEW: Record<string, string> = {
  cart: "The shopper's cart items, quantities and totals appear here.",
  checkout: "The checkout form — delivery details, MTN MoMo or cash on delivery — appears here.",
  order: "The order summary and live payment status appear here after checkout.",
};

function SystemMainSection({ section, ctx }: Props) {
  const slot = useContext(SystemSlotContext);
  if (slot) return <>{slot}</>;
  if (!ctx.editing) return null;
  // Editor preview of the built-in content.
  const kind = section.type.replace(/-main$/, "");
  if (kind === "shop" || kind === "collection") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 @2xl:px-6">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--sf-heading)" }}>{kind === "shop" ? "All products" : ctx.categories[0]?.name ?? "Category"}</h1>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 @2xl:grid-cols-3 @5xl:grid-cols-4">
          {ctx.products.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} ctx={ctx} />)}
        </div>
        {!ctx.products.length && <p className="py-16 text-center opacity-60">Your products appear here.</p>}
      </div>
    );
  }
  if (kind === "product") {
    const p = ctx.products[0];
    return (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 @2xl:px-6 @3xl:grid-cols-2">
        <div className="aspect-square overflow-hidden bg-black/5" style={{ borderRadius: "var(--sf-radius)" }}>{p?.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}</div>
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--sf-heading)" }}>{p?.name ?? "Product name"}</h1>
          <p className="text-xl font-semibold">{p ? formatMoney(p.price, ctx.store.currency) : "—"}</p>
          <span className="inline-flex w-fit px-6 py-3 text-sm font-semibold" style={{ background: "var(--sf-primary)", color: "var(--sf-on-primary)", borderRadius: "var(--sf-radius-btn)" }}>Add to cart</span>
          <p className="text-sm opacity-60">Every product uses this layout. The content changes per product.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto my-8 flex max-w-3xl items-center justify-center rounded-lg border-2 border-dashed border-current/20 px-6 py-16 text-center text-sm opacity-70">
      {SYSTEM_PREVIEW[kind] ?? "Built-in content"}
    </div>
  );
}

export function CustomSection({ section, ctx }: Props) {
  const nodes = section.nodes ?? [];
  return (
    <section className="sf-custom">
      {nodes.length ? <NodeTree nodes={nodes} ctx={ctx} parentStyle={section.style} /> : ctx.editing ? (
        <div className="m-4 flex min-h-[160px] items-center justify-center rounded-lg border-2 border-dashed border-current/20 text-sm opacity-60">Drag elements here from the left panel</div>
      ) : null}
    </section>
  );
}

export const SECTION_COMPONENTS: Record<string, (p: Props) => ReactNode> = {
  custom: CustomSection,
  "shop-main": SystemMainSection,
  "product-main": SystemMainSection,
  "collection-main": SystemMainSection,
  "cart-main": SystemMainSection,
  "checkout-main": SystemMainSection,
  "order-main": SystemMainSection,
  header: HeaderSection,
  announcement: AnnouncementSection,
  hero: HeroSection,
  features: FeaturesSection,
  text: TextSection,
  image: ImageSection,
  gallery: GallerySection,
  "product-grid": ProductGridSection,
  categories: CategoriesSection,
  "promo-banner": PromoBannerSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
  contact: ContactSection,
  button: ButtonSection,
  spacer: SpacerSection,
  footer: FooterSection,
};

/**
 * Size set by dragging a section's edges in the editor: `minHeight` (px) and
 * `width` (% of the page, applied on wide screens only so phones stay full-width).
 */
export function sectionBox(section: Section): { className: string; style: CSSProperties } | null {
  const h = num(section, "minHeight", 0);
  const w = num(section, "width", 100);
  const sized = h > 0, narrow = w > 0 && w < 100;
  if (!sized && !narrow) return null;
  return {
    className: cx("flex flex-col *:grow", narrow && "@3xl:mx-auto @3xl:w-(--sf-box-w)"),
    style: { ...(sized ? { minHeight: h } : {}), ...(narrow ? { "--sf-box-w": `${w}%` } : {}) } as CSSProperties,
  };
}

/** `bare`: skip the sizing wrapper (the editor canvas applies it to its own box). */
export function RenderSection({ section, ctx, bare }: Props & { bare?: boolean }) {
  if (section.hidden) return null;
  const C = SECTION_COMPONENTS[section.type];
  if (!C) return null;
  let el = <C section={section} ctx={ctx} />;
  // Advanced tab: margin/width/position on a wrapper, padding/background/
  // typography on the section itself (`!important` beats each section's own
  // inline colours, which are just its defaults).
  const tw = twClasses(section.tw).join(" ");
  if (section.style || tw) {
    const sel = `.s-${section.id}`;
    const css = section.style ? buildCss(section.style, [{ sel, groups: ["outer"] }, { sel: `${sel}>*`, groups: ["skin", "layout"], important: true }], sel, !!ctx.editing) : "";
    el = (
      <>
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <div className={cx("relative", `s-${section.id}`, tw)}>{el}</div>
      </>
    );
  }
  const box = bare ? null : sectionBox(section);
  return box ? <div className={box.className} style={box.style}>{el}</div> : el;
}
