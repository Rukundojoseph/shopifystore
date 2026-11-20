import { z } from "zod";
import { FONTS } from "./fonts";
import { MAX_TW_LENGTH, invalidTwTokens } from "./tailwind";

// The website layout is persisted as this JSON document (Store.draftConfig /
// Store.publishedConfig). It is validated on every save because it is user input.

const scalar = z.union([z.string().max(5000), z.number().finite(), z.boolean(), z.null()]);
const listItem = z.record(z.string().max(40), z.union([z.string().max(2000), z.number().finite(), z.boolean()]));
const settingValue = z.union([scalar, z.array(listItem).max(50)]);

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ─── Advanced styling (Elementor-style) ──────────────────────────────────────
// Every value is an enum, a bounded number or a hex colour, so the CSS built
// from it (components/storefront/style-css.ts) can never carry injected CSS.

const n = (min: number, max: number) => z.number().finite().min(min).max(max);
export const UNITS = ["px", "%", "em", "rem", "vw", "vh"] as const;
const length = z.object({ v: n(-5000, 5000), u: z.enum(UNITS) });
const box = z.object({ t: n(-2000, 2000), r: n(-2000, 2000), b: n(-2000, 2000), l: n(-2000, 2000), u: z.enum(["px", "%", "em", "rem"]) });
/** Hex, or a theme token so designs follow the store's theme colours. */
export const COLOR_TOKENS = ["primary", "secondary", "bg", "text", "white", "black", "transparent"] as const;
const color = z.union([hex, z.enum(COLOR_TOKENS)]);

export const styleSchema = z.object({
  // Layout (containers)
  direction: z.enum(["row", "column", "row-reverse", "column-reverse"]).optional(),
  justify: z.enum(["start", "center", "end", "between", "around", "evenly"]).optional(),
  align: z.enum(["start", "center", "end", "stretch", "baseline"]).optional(),
  wrap: z.boolean().optional(),
  gap: n(0, 400).optional(),
  // As a child of a flex container
  grow: n(0, 12).optional(),
  alignSelf: z.enum(["auto", "start", "center", "end", "stretch"]).optional(),
  /** Push to the start or end of the parent's main axis (auto margin). */
  push: z.enum(["start", "end"]).optional(),
  order: n(-20, 20).optional(),
  // Spacing & size
  padding: box.optional(),
  margin: box.optional(),
  width: length.optional(),
  maxWidth: length.optional(),
  minHeight: length.optional(),
  height: length.optional(),
  // Background
  bg: color.optional(),
  bgImage: z.string().max(1000).optional(),
  bgSize: z.enum(["cover", "contain", "auto"]).optional(),
  bgPosition: z.enum(["center", "top", "bottom", "left", "right"]).optional(),
  overlay: n(0, 90).optional(),
  // Typography
  color: color.optional(),
  /** Theme fonts, or one named font from the list (lib/editor/fonts.ts). */
  font: z.enum(["body", "heading", ...FONTS]).optional(),
  fontSize: n(6, 200).optional(),
  fontWeight: z.enum(["300", "400", "500", "600", "700", "800", "900"]).optional(),
  lineHeight: n(0.5, 4).optional(),
  letterSpacing: n(-5, 30).optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  italic: z.boolean().optional(),
  // Border & effects
  radius: n(0, 999).optional(),
  borderWidth: n(0, 50).optional(),
  borderStyle: z.enum(["solid", "dashed", "dotted", "none"]).optional(),
  borderColor: color.optional(),
  shadow: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
  opacity: n(0, 100).optional(),
  // Position
  position: z.enum(["static", "relative", "absolute", "sticky"]).optional(),
  top: length.optional(),
  right: length.optional(),
  bottom: length.optional(),
  left: length.optional(),
  zIndex: n(-10, 999).optional(),
  overflow: z.enum(["visible", "hidden"]).optional(),
  hidden: z.boolean().optional(),
});

/** Desktop-first: tablet and mobile hold only the values that differ. */
export const responsiveStyleSchema = z.object({
  desktop: styleSchema.optional(),
  tablet: styleSchema.optional(),
  mobile: styleSchema.optional(),
});

export const NODE_TYPES = [
  "container", "heading", "text", "image", "button", "spacer", "divider", "icon", "video",
  "search", "form", "input", "textarea", "select", "checkbox",
  "logo", "menu", "cart",
  // Product grid (a repeating list, like Bubble's repeating group): its
  // children are the card design, repeated once per product; the product-*
  // elements show the current product's data.
  "products", "product-image", "product-name", "product-price", "product-button",
] as const;
/** Node types that hold children. */
export const PARENT_TYPES = new Set<string>(["container", "form", "products"]);
/** Elements that show data of the product their grid card is repeating. */
export const PRODUCT_PART_TYPES = new Set<string>(["product-image", "product-name", "product-price", "product-button"]);
export const MAX_NODE_DEPTH = 6;
export const MAX_NODES_PER_SECTION = 300;

/** Custom Tailwind classes (Advanced tab) — class names only, see lib/editor/tailwind.ts. */
const twSchema = z.string().max(MAX_TW_LENGTH).refine((v) => !invalidTwTokens(v).length, "Unsupported characters in Tailwind classes");

const nodeProp = z.union([z.string().max(5000), z.number().finite(), z.boolean()]);

const id = z.string().regex(/^[a-z0-9-]{1,64}$/);

// ─── Conditions (Bubble-style "when … change style") ────────────────────────
// Compiled to CSS (components/storefront/nodes.tsx); "clicked", "state" and
// "scrolled" use attributes the workflow runtime toggles on the store root.

export const conditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hover") }),
  z.object({ type: z.literal("pressed") }),
  z.object({ type: z.literal("focus") }),
  z.object({ type: z.literal("clicked") }),
  z.object({ type: z.literal("state"), nodeId: id }),
  z.object({ type: z.literal("scrolled"), offset: n(0, 20000) }),
  z.object({ type: z.literal("width"), min: n(0, 4000).optional(), max: n(0, 4000).optional() }),
]);
export const conditionalSchema = z.object({ id, when: conditionSchema, style: styleSchema });
export type Condition = z.infer<typeof conditionSchema>;
export type Conditional = z.infer<typeof conditionalSchema>;

export type LayoutNode = {
  id: string;
  type: (typeof NODE_TYPES)[number];
  props: Record<string, string | number | boolean>;
  style?: z.infer<typeof responsiveStyleSchema>;
  conditions?: Conditional[];
  children?: LayoutNode[];
  /** Custom Tailwind classes. */
  tw?: string;
};

export const nodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
  z.object({
    id,
    type: z.enum(NODE_TYPES),
    props: z.record(z.string().max(40), nodeProp),
    style: responsiveStyleSchema.optional(),
    conditions: z.array(conditionalSchema).max(20).optional(),
    children: z.array(nodeSchema).max(60).optional(),
    tw: twSchema.optional(),
  }),
);

function treeStats(nodes: LayoutNode[], depth = 1, inForm = false): { count: number; depth: number; nestedForm: boolean } {
  let count = 0, max = 0, nestedForm = false;
  for (const node of nodes) {
    if (node.type === "form" && inForm) nestedForm = true;
    const sub = node.children?.length ? treeStats(node.children, depth + 1, inForm || node.type === "form") : { count: 0, depth, nestedForm: false };
    count += 1 + sub.count;
    max = Math.max(max, sub.depth, depth);
    nestedForm ||= sub.nestedForm;
  }
  return { count, depth: max, nestedForm };
}

export const sectionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    type: z.string().regex(/^[a-z-]{1,40}$/),
    hidden: z.boolean().optional(),
    settings: z.record(z.string().max(40), settingValue),
    style: responsiveStyleSchema.optional(),
    /** Custom Tailwind classes on the section's wrapper. */
    tw: twSchema.optional(),
    nodes: z.array(nodeSchema).max(60).optional(),
    /** Header only: the merchant's own elements inside the navigation bar row. */
    navNodes: z.array(nodeSchema).max(30).optional(),
    /** Header only: a fully custom navigation bar that replaces the standard one. */
    barNodes: z.array(nodeSchema).max(30).optional(),
  })
  .superRefine((s, ctx) => {
    const all = [...(s.nodes ?? []), ...(s.navNodes ?? []), ...(s.barNodes ?? [])];
    if (!all.length) return;
    const { count, depth, nestedForm } = treeStats(all);
    if (nestedForm) ctx.addIssue({ code: "custom", message: "A form can't be placed inside another form" });
    if (count > MAX_NODES_PER_SECTION) ctx.addIssue({ code: "custom", message: `A custom section can hold at most ${MAX_NODES_PER_SECTION} elements` });
    if (depth > MAX_NODE_DEPTH) ctx.addIssue({ code: "custom", message: `Containers can be nested at most ${MAX_NODE_DEPTH} levels deep` });
  });

export const themeSchema = z.object({
  primaryColor: hex,
  secondaryColor: hex,
  backgroundColor: hex,
  textColor: hex,
  font: z.string().max(60),
  headingFont: z.string().max(60),
  radius: z.enum(["none", "sm", "md", "lg", "full"]),
});

export const pageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: z.string().min(1).max(60),
  slug: z.string().regex(/^\/[a-z0-9-]{0,40}$/),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(300).optional(),
  sections: z.array(sectionSchema).max(60),
});

// ─── Workflows (Bubble-style "when … do …") ─────────────────────────────────

const link = z.string().max(500);
const fieldName = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const orderRef = { orderField: fieldName.optional(), orderNumber: z.number().int().min(1).max(10_000_000).optional() };
export const ORDER_STATUSES = ["PENDING", "PROCESSING", "READY_FOR_DELIVERY", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("goToPage"), to: link }),
  z.object({ id, type: z.literal("openUrl"), url: link, newTab: z.boolean().optional() }),
  z.object({ id, type: z.literal("scrollTo"), nodeId: id.optional() }),
  z.object({ id, type: z.literal("show"), nodeId: id }),
  z.object({ id, type: z.literal("hide"), nodeId: id }),
  z.object({ id, type: z.literal("toggle"), nodeId: id }),
  z.object({ id, type: z.literal("toggleState"), nodeId: id }),
  z.object({ id, type: z.literal("showMessage"), text: z.string().max(300) }),
  z.object({ id, type: z.literal("wait"), ms: n(0, 10_000) }),
  z.object({ id, type: z.literal("addToCart"), productId: z.string().max(64), quantity: n(1, 99) }),
  z.object({ id, type: z.literal("submitForm") }),
  z.object({ id, type: z.literal("subscribe"), field: fieldName }),
  z.object({ id, type: z.literal("resetForm") }),
  // Staff-only: run only for signed-in store staff, re-checked on the server.
  z.object({ id, type: z.literal("cancelOrder"), ...orderRef }),
  z.object({ id, type: z.literal("setOrderStatus"), status: z.enum(ORDER_STATUSES), ...orderRef }),
  z.object({ id, type: z.literal("deleteOrder"), ...orderRef }),
]);
export type WorkflowAction = z.infer<typeof actionSchema>;
export type ActionType = WorkflowAction["type"];
export const STAFF_ACTIONS = new Set<ActionType>(["cancelOrder", "setOrderStatus", "deleteOrder"]);

export const triggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), nodeId: id }),
  z.object({ type: z.literal("submit"), nodeId: id }),
  z.object({ type: z.literal("pageLoad"), pageId: z.string().max(64) }),
  z.object({ type: z.literal("scroll"), pageId: z.string().max(64), offset: n(0, 20000) }),
]);
export type Trigger = z.infer<typeof triggerSchema>;

/** "Only when" for a whole workflow. */
export const workflowWhenSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("width"), min: n(0, 4000).optional(), max: n(0, 4000).optional() }),
  z.object({ type: z.literal("scrolled"), offset: n(0, 20000) }),
  z.object({ type: z.literal("state"), nodeId: id }),
]);

export const workflowSchema = z.object({
  id,
  name: z.string().max(80),
  disabled: z.boolean().optional(),
  trigger: triggerSchema,
  when: workflowWhenSchema.optional(),
  actions: z.array(actionSchema).max(20),
});
export type Workflow = z.infer<typeof workflowSchema>;

// ─── Built-in shop pages ────────────────────────────────────────────────────
// Each holds sections around one "<kind>-main" section that renders the
// page's own content (product list, cart, checkout…).

export const SYSTEM_PAGES = [
  { kind: "shop", name: "Shop (all products)", slug: "/products" },
  { kind: "product", name: "Product page", slug: "/products/…" },
  { kind: "collection", name: "Category page", slug: "/collections/…" },
  { kind: "cart", name: "Cart", slug: "/cart" },
  { kind: "checkout", name: "Checkout", slug: "/checkout" },
  { kind: "order", name: "Order confirmation", slug: "/orders/…" },
] as const;
export type SystemPageKind = (typeof SYSTEM_PAGES)[number]["kind"];
const systemPagesSchema = z.object(Object.fromEntries(SYSTEM_PAGES.map((p) => [p.kind, z.array(sectionSchema).max(40).optional()])) as Record<SystemPageKind, z.ZodOptional<z.ZodArray<typeof sectionSchema>>>);

export const siteConfigSchema = z.object({
  version: z.literal(1),
  template: z.string().max(40),
  theme: themeSchema,
  seo: z.object({
    title: z.string().max(120).optional(),
    description: z.string().max(300).optional(),
    image: z.string().max(1000).optional(),
    noindex: z.boolean().optional(),
  }),
  header: sectionSchema,
  footer: sectionSchema,
  pages: z.array(pageSchema).min(1).max(20),
  systemPages: systemPagesSchema.partial().optional(),
  workflows: z.array(workflowSchema).max(100).optional(),
});

export type Section = z.infer<typeof sectionSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type SitePage = z.infer<typeof pageSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type SettingValue = z.infer<typeof settingValue>;
export type Style = z.infer<typeof styleSchema>;
export type ResponsiveStyle = z.infer<typeof responsiveStyleSchema>;
export type Device = keyof ResponsiveStyle;
export type NodeType = (typeof NODE_TYPES)[number];
export type ListItem = z.infer<typeof listItem>;

/** Only http(s), mailto:, tel: and site-relative links are rendered. */
export function safeHref(href: unknown, fallback = "#"): string {
  if (typeof href !== "string" || !href.trim()) return fallback;
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (h.startsWith("#")) return h;
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  return fallback;
}

export function safeImage(src: unknown): string | null {
  if (typeof src !== "string" || !src.trim()) return null;
  const s = src.trim();
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https:\/\//i.test(s)) return s;
  return null;
}

// ─── Saved blocks / page templates (SavedTemplate.data) ─────────────────────

export const savedBlockSchema = z.union([z.object({ section: sectionSchema }), z.object({ node: nodeSchema })]);
export const savedPageSchema = z.object({ page: pageSchema });
export type SavedBlockData = z.infer<typeof savedBlockSchema>;
export type SavedPageData = z.infer<typeof savedPageSchema>;
export type SavedTemplateItem =
  | { id: string; kind: "BLOCK"; name: string; data: SavedBlockData }
  | { id: string; kind: "PAGE"; name: string; data: SavedPageData };

/** Parses a stored row, dropping any that no longer match the schema. */
export function parseSavedTemplate(row: { id: string; kind: string; name: string; data: unknown }): SavedTemplateItem | null {
  if (row.kind === "BLOCK") {
    const p = savedBlockSchema.safeParse(row.data);
    return p.success ? { id: row.id, kind: "BLOCK", name: row.name, data: p.data } : null;
  }
  const p = savedPageSchema.safeParse(row.data);
  return p.success ? { id: row.id, kind: "PAGE", name: row.name, data: p.data } : null;
}
