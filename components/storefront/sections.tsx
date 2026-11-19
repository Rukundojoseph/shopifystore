/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Menu, Search, ShoppingBag, X, Phone, Mail, MapPin, MessageCircle, Clock, Truck, ShieldCheck, Smartphone, Instagram, Facebook } from "lucide-react";
import type { Section } from "@/lib/editor/schema";
import { safeHref, safeImage } from "@/lib/editor/schema";
import { bool, list, num, str } from "@/lib/editor/sections";
import { formatMoney } from "@/lib/money";
import { PAD, contrastText } from "./theme";
import { href, type StorefrontCtx, type StorefrontProduct } from "./types";
import { useCart } from "./cart";

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

function Heading({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <h2 className={cx("text-2xl font-semibold tracking-tight @2xl:text-3xl", className)} style={{ fontFamily: "var(--sf-heading)" }}>
      {children}
    </h2>
  );
}

export function SfButton({ text, to, ctx, variant = "solid", className }: { text: string; to: string; ctx: StorefrontCtx; variant?: "solid" | "outline" | "light"; className?: string }) {
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
      {text}
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

export function HeaderSection({ section, ctx }: Props) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const style = str(section, "style");
  const colors: CSSProperties =
    style === "dark" ? { background: "#0b0b0c", color: "#fafafa" } : style === "brand" ? { background: "var(--sf-primary)", color: contrastText(ctx.theme.primaryColor) } : { background: "var(--sf-bg)", color: "var(--sf-text)" };
  const links = list(section, "links");
  const logo = safeImage(str(section, "logoImage"));
  const name = str(section, "logoText") || ctx.store.name;

  return (
    <header className={cx("z-30 border-b border-black/5", bool(section, "sticky") && !ctx.editing && "sticky top-0")} style={colors}>
      <Container className="flex h-16 items-center gap-4">
        <button className="-ml-2 inline-flex h-10 w-10 items-center justify-center @3xl:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link href={href(ctx, "/")} className="flex min-w-0 items-center gap-2">
          {logo ? <img src={logo} alt={name} className="h-9 w-auto max-w-[160px] object-contain" /> : <span className="truncate text-lg font-bold tracking-tight" style={{ fontFamily: "var(--sf-heading)" }}>{name}</span>}
        </Link>
        <nav className="ml-6 hidden items-center gap-6 text-sm font-medium @3xl:flex">
          {links.map((l, i) => (
            <Link key={i} href={href(ctx, safeHref(l.href, "/"))} className="opacity-80 transition hover:opacity-100">{String(l.label ?? "")}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {bool(section, "showSearch") && (
            <button className="inline-flex h-10 w-10 items-center justify-center" onClick={() => setSearching((s) => !s)} aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
          )}
          {bool(section, "showCart") && <CartLink ctx={ctx} />}
        </div>
      </Container>
      {searching && (
        <Container className="pb-3">
          <form action={href(ctx, "/products")} method="get">
            <input name="q" autoFocus placeholder="Search products…" className="w-full border border-current/20 bg-white/90 px-4 py-2.5 text-sm text-zinc-900 outline-none" style={{ borderRadius: "var(--sf-radius)" }} />
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
  const inner = <p className="px-4 py-2 text-center text-xs font-medium @2xl:text-sm">{text}</p>;
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
            <h1 className="text-4xl font-bold leading-tight tracking-tight @2xl:text-5xl" style={{ fontFamily: "var(--sf-heading)" }}>{heading}</h1>
            {sub && <p className="max-w-lg text-base opacity-80 @2xl:text-lg">{sub}</p>}
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
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight @2xl:text-6xl" style={{ fontFamily: "var(--sf-heading)" }}>{heading}</h1>
        {sub && <p className="max-w-xl text-base opacity-90 @2xl:text-lg">{sub}</p>}
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
                <p className="font-semibold">{String(it.title ?? "")}</p>
                <p className="text-sm opacity-70">{String(it.text ?? "")}</p>
              </div>
            </div>
          );
        })}
      </Container>
    </Wrap>
  );
}

export function TextSection({ section }: Props) {
  return (
    <Wrap section={section}>
      <Container className={cx("flex max-w-3xl flex-col gap-4", alignCls(str(section, "align")))}>
        <Heading>{str(section, "heading")}</Heading>
        <p className="whitespace-pre-line text-base leading-relaxed opacity-80">{str(section, "body")}</p>
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
        {str(section, "caption") && <p className="mt-3 text-center text-sm opacity-70">{str(section, "caption")}</p>}
      </div>
    </Wrap>
  );
}

const COLS: Record<string, string> = { "2": "@2xl:grid-cols-2", "3": "@2xl:grid-cols-2 @5xl:grid-cols-3", "4": "@2xl:grid-cols-3 @5xl:grid-cols-4", "5": "@2xl:grid-cols-3 @5xl:grid-cols-5", "6": "@2xl:grid-cols-3 @5xl:grid-cols-6" };

export function GallerySection({ section, ctx }: Props) {
  const images = list(section, "images").filter((i) => safeImage(i.image));
  return (
    <Wrap section={section}>
      <Container className="flex flex-col gap-8">
        <Heading className="text-center">{str(section, "heading")}</Heading>
        {images.length ? (
          <div className={cx("grid grid-cols-2 gap-3", COLS[str(section, "columns")] ?? COLS["3"])}>
            {images.map((img, i) => (
              <figure key={i} className="overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}>
                <img src={safeImage(img.image)!} alt={String(img.caption ?? "")} className="aspect-square w-full object-cover transition duration-500 hover:scale-105" />
                {img.caption ? <figcaption className="mt-2 text-sm opacity-70">{String(img.caption)}</figcaption> : null}
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

export function ProductCard({ product, ctx, ratio = "square" }: { product: StorefrontProduct; ctx: StorefrontCtx; ratio?: string }) {
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price;
  return (
    <Link href={href(ctx, `/products/${product.slug}`)} className="group flex flex-col gap-3">
      <div className={cx("relative overflow-hidden bg-black/5", RATIO[ratio] ?? RATIO.square)} style={{ borderRadius: "var(--sf-radius)" }}>
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs opacity-50">No image</div>
        )}
        {onSale ? <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-red-600">Sale</span> : null}
        {!product.inStock ? <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white">Sold out</span> : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
        <p className="text-sm">
          <span className="font-semibold">{formatMoney(product.price, ctx.store.currency)}</span>
          {onSale ? <span className="ml-2 text-xs line-through opacity-50">{formatMoney(product.compareAtPrice!, ctx.store.currency)}</span> : null}
        </p>
      </div>
    </Link>
  );
}

export function selectProducts(section: Section, products: StorefrontProduct[]) {
  let items = [...products];
  const source = str(section, "source");
  if (source === "featured") items = items.filter((p) => p.featured);
  if (source === "category") {
    const cat = str(section, "category");
    if (cat) items = items.filter((p) => p.categorySlug === cat);
  }
  const sort = str(section, "sort");
  items.sort((a, b) =>
    sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : b.createdAt - a.createdAt,
  );
  return items.slice(0, Math.max(1, Math.min(24, num(section, "limit", 8))));
}

export function ProductGridSection({ section, ctx }: Props) {
  const items = selectProducts(section, ctx.products);
  const cat = str(section, "category");
  return (
    <Wrap section={section}>
      <Container className="flex flex-col gap-8">
        <div className="flex items-end justify-between gap-4">
          <Heading>{str(section, "heading")}</Heading>
          {bool(section, "showViewAll") && (
            <Link href={href(ctx, str(section, "source") === "category" && cat ? `/collections/${cat}` : "/products")} className="shrink-0 text-sm font-medium underline underline-offset-4">
              View all
            </Link>
          )}
        </div>
        {items.length ? (
          <div className={cx("grid grid-cols-2 gap-x-4 gap-y-8", COLS[str(section, "columns")] ?? COLS["4"])}>
            {items.map((p) => <ProductCard key={p.id} product={p} ctx={ctx} ratio={str(section, "imageRatio")} />)}
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
        <Heading className={pills ? "" : "text-center"}>{str(section, "heading")}</Heading>
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
            <Heading>{str(section, "heading")}</Heading>
            {str(section, "text") && <p className="opacity-80">{str(section, "text")}</p>}
            <SfButton text={str(section, "buttonText")} to={str(section, "buttonLink")} ctx={ctx} />
          </div>
          {image && <img src={image} alt="" className="h-full min-h-[240px] w-full object-cover" />}
        </div>
      </Container>
    </Wrap>
  );
}

export function TestimonialsSection({ section }: Props) {
  const items = list(section, "items");
  return (
    <Wrap section={section}>
      <Container className="flex flex-col gap-8">
        <Heading className="text-center">{str(section, "heading")}</Heading>
        <div className="grid gap-4 @3xl:grid-cols-3">
          {items.map((t, i) => (
            <figure key={i} className="flex flex-col gap-4 border border-current/10 p-6" style={{ borderRadius: "var(--sf-radius)" }}>
              <blockquote className="text-base leading-relaxed">“{String(t.quote ?? "")}”</blockquote>
              <figcaption className="text-sm">
                <span className="font-semibold">{String(t.author ?? "")}</span>
                {t.role ? <span className="opacity-60"> · {String(t.role)}</span> : null}
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
        <Heading>{str(section, "heading")}</Heading>
        <p className="opacity-80">{str(section, "text")}</p>
        {state === "done" ? (
          <p className="font-medium">Thank you — you are subscribed.</p>
        ) : (
          <form onSubmit={submit} className="flex w-full flex-col gap-2 @2xl:flex-row">
            <input required type="email" name="email" placeholder="you@example.com" className="min-w-0 flex-1 border border-current/20 bg-white px-4 py-3 text-sm text-zinc-900 outline-none" style={{ borderRadius: "var(--sf-radius-btn)" }} />
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
          <Heading>{str(section, "heading")}</Heading>
          <p className="whitespace-pre-line opacity-80">{str(section, "text")}</p>
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
        <SfButton text={str(section, "text")} to={str(section, "link")} ctx={ctx} variant={str(section, "style") === "outline" ? "outline" : "solid"} />
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
          <p className="text-sm opacity-75">{str(section, "text")}</p>
        </div>
        <nav className="flex flex-col gap-2 text-sm">
          {links.map((l, i) => (
            <Link key={i} href={href(ctx, safeHref(l.href, "/"))} className="opacity-80 hover:opacity-100">{String(l.label ?? "")}</Link>
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

export const SECTION_COMPONENTS: Record<string, (p: Props) => ReactNode> = {
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

export function RenderSection({ section, ctx }: Props) {
  if (section.hidden) return null;
  const C = SECTION_COMPONENTS[section.type];
  return C ? <C section={section} ctx={ctx} /> : null;
}
