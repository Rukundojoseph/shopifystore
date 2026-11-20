import { PARENT_TYPES, type Device, type LayoutNode, type NodeType, type ResponsiveStyle, type Section, type Style } from "./schema";

// Pure helpers for the custom-layout node tree (Section.nodes). Everything
// returns new objects so they can feed the editor's undo history directly.

export const DEVICES: Device[] = ["desktop", "tablet", "mobile"];

export function newNodeId(type: string): string {
  return `${type.slice(0, 12)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Lookup ────────────────────────────────────────────────────────────────

export function findNode(nodes: LayoutNode[], id: string): LayoutNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = n.children ? findNode(n.children, id) : null;
    if (hit) return hit;
  }
  return null;
}

/** Ancestors from the root down to (excluding) the node, or null if absent. */
export function nodePath(nodes: LayoutNode[], id: string, trail: LayoutNode[] = []): LayoutNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return trail;
    if (n.children) {
      const hit = nodePath(n.children, id, [...trail, n]);
      if (hit) return hit;
    }
  }
  return null;
}

export function findParent(nodes: LayoutNode[], id: string): { parent: LayoutNode | null; index: number } | null {
  const i = nodes.findIndex((n) => n.id === id);
  if (i >= 0) return { parent: null, index: i };
  for (const n of nodes) {
    if (!n.children) continue;
    const j = n.children.findIndex((c) => c.id === id);
    if (j >= 0) return { parent: n, index: j };
    const deeper = findParent(n.children, id);
    if (deeper) return deeper;
  }
  return null;
}

export function containsNode(node: LayoutNode, id: string): boolean {
  return node.id === id || !!node.children?.some((c) => containsNode(c, id));
}

export function countNodes(nodes: LayoutNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children ?? []), 0);
}

export function treeDepth(nodes: LayoutNode[]): number {
  return nodes.reduce((max, n) => Math.max(max, 1 + treeDepth(n.children ?? [])), 0);
}

// ─── Edits ─────────────────────────────────────────────────────────────────

export function updateNode(nodes: LayoutNode[], id: string, fn: (n: LayoutNode) => LayoutNode): LayoutNode[] {
  let changed = false;
  const out = nodes.map((n) => {
    if (n.id === id) { changed = true; return fn(n); }
    if (!n.children) return n;
    const kids = updateNode(n.children, id, fn);
    if (kids !== n.children) { changed = true; return { ...n, children: kids }; }
    return n;
  });
  return changed ? out : nodes;
}

export function removeNode(nodes: LayoutNode[], id: string): LayoutNode[] {
  const filtered = nodes.filter((n) => n.id !== id);
  if (filtered.length !== nodes.length) return filtered;
  let changed = false;
  const out = nodes.map((n) => {
    if (!n.children) return n;
    const kids = removeNode(n.children, id);
    if (kids !== n.children) { changed = true; return { ...n, children: kids }; }
    return n;
  });
  return changed ? out : nodes;
}

/** Insert into `parentId`'s children (null = top level) at `index` (default: end). */
export function insertNode(nodes: LayoutNode[], parentId: string | null, node: LayoutNode, index?: number): LayoutNode[] {
  const put = (list: LayoutNode[]) => {
    const at = index === undefined ? list.length : Math.max(0, Math.min(list.length, index));
    return [...list.slice(0, at), node, ...list.slice(at)];
  };
  if (parentId === null) return put(nodes);
  return updateNode(nodes, parentId, (p) => ({ ...p, children: put(p.children ?? []) }));
}

export type DropPosition = "before" | "after" | "inside";

/** Insert `node` relative to `targetId`. */
export function insertRelative(nodes: LayoutNode[], targetId: string, node: LayoutNode, pos: DropPosition): LayoutNode[] {
  if (pos === "inside") return insertNode(nodes, targetId, node);
  const loc = findParent(nodes, targetId);
  if (!loc) return nodes;
  return insertNode(nodes, loc.parent?.id ?? null, node, loc.index + (pos === "after" ? 1 : 0));
}

/** Move a node within one tree. No-op when dropping a node into itself. */
export function moveNode(nodes: LayoutNode[], id: string, targetId: string, pos: DropPosition): LayoutNode[] {
  const node = findNode(nodes, id);
  if (!node || id === targetId || containsNode(node, targetId)) return nodes;
  return insertRelative(removeNode(nodes, id), targetId, node, pos);
}

/** Swap with the previous/next sibling. */
export function shiftNode(nodes: LayoutNode[], id: string, dir: -1 | 1): LayoutNode[] {
  const loc = findParent(nodes, id);
  if (!loc) return nodes;
  const list = loc.parent ? loc.parent.children! : nodes;
  const j = loc.index + dir;
  if (j < 0 || j >= list.length) return nodes;
  const next = [...list];
  [next[loc.index], next[j]] = [next[j], next[loc.index]];
  return loc.parent ? updateNode(nodes, loc.parent.id, (p) => ({ ...p, children: next })) : next;
}

/** Deep copy with fresh ids everywhere (used for duplicate and saved blocks). */
export function cloneNode(node: LayoutNode): LayoutNode {
  const copy: LayoutNode = { ...structuredClone(node), id: newNodeId(node.type), children: node.children?.map(cloneNode) };
  if (copy.conditions) copy.conditions = copy.conditions.map((c) => ({ ...c, id: newNodeId("cond") }));
  return copy;
}

export function duplicateNode(nodes: LayoutNode[], id: string): { nodes: LayoutNode[]; copyId: string | null } {
  const node = findNode(nodes, id);
  if (!node) return { nodes, copyId: null };
  const copy = cloneNode(node);
  return { nodes: insertRelative(nodes, id, copy, "after"), copyId: copy.id };
}

export function cloneSection(section: Section, newId: string): Section {
  return { ...structuredClone(section), id: newId, nodes: section.nodes?.map(cloneNode) };
}

// ─── Responsive styles ─────────────────────────────────────────────────────

/** Desktop → tablet → mobile cascade, like Elementor. */
export function effectiveStyle(rs: ResponsiveStyle | undefined, device: Device): Style {
  if (!rs) return {};
  const out: Style = { ...rs.desktop };
  if (device !== "desktop") Object.assign(out, rs.tablet);
  if (device === "mobile") Object.assign(out, rs.mobile);
  return out;
}

/** Which device a value is inherited from (for the "overridden here" marker). */
export function styleSource(rs: ResponsiveStyle | undefined, device: Device, key: keyof Style): Device | null {
  const order: Device[] = device === "mobile" ? ["mobile", "tablet", "desktop"] : device === "tablet" ? ["tablet", "desktop"] : ["desktop"];
  return order.find((d) => rs?.[d]?.[key] !== undefined) ?? null;
}

/** Set (or with `undefined`, clear) one style key on one device layer. */
export function setStyleValue<K extends keyof Style>(rs: ResponsiveStyle | undefined, device: Device, key: K, value: Style[K] | undefined): ResponsiveStyle | undefined {
  const layer: Style = { ...(rs?.[device] ?? {}) };
  if (value === undefined || value === null) delete layer[key];
  else layer[key] = value;
  const next: ResponsiveStyle = { ...rs, [device]: layer };
  if (!Object.keys(layer).length) delete next[device];
  return Object.keys(next).length ? next : undefined;
}

// ─── Factories ─────────────────────────────────────────────────────────────

const ELEMENT_DEFAULTS: Record<NodeType, { props: LayoutNode["props"]; style?: ResponsiveStyle }> = {
  container: { props: { contentWidth: "full" }, style: { desktop: { direction: "column", gap: 16, padding: { t: 16, r: 16, b: 16, l: 16, u: "px" } } } },
  heading: { props: { text: "Add your heading", tag: "h2" }, style: { desktop: { font: "heading", fontSize: 32, fontWeight: "700", lineHeight: 1.2 } } },
  text: { props: { text: "Write something about your products, your story or your offer. Double-click to edit." }, style: { desktop: { lineHeight: 1.6 } } },
  image: { props: { src: "", alt: "", link: "", fit: "cover" } },
  button: { props: { text: "Shop now", link: "/products", variant: "solid" } },
  spacer: { props: {}, style: { desktop: { height: { v: 40, u: "px" } } } },
  divider: { props: { thickness: 1 }, style: { desktop: { margin: { t: 8, r: 0, b: 8, l: 0, u: "px" } } } },
  icon: { props: { icon: "star", size: 32 }, style: { desktop: { color: "primary" } } },
  video: { props: { provider: "youtube", videoId: "" } },
  search: { props: { placeholder: "Search products…", buttonText: "Search" } },
  form: { props: { formName: "Contact form", successMessage: "Thank you! We'll get back to you soon." }, style: { desktop: { direction: "column", gap: 12 } } },
  input: { props: { label: "Your name", name: "name", inputType: "text", placeholder: "", required: false } },
  textarea: { props: { label: "Message", name: "message", placeholder: "", rows: 4, required: false } },
  select: { props: { label: "Choose one", name: "choice", options: "Option 1\nOption 2\nOption 3", required: false } },
  checkbox: { props: { label: "I agree to be contacted", name: "consent", required: false } },
  logo: { props: { text: "", image: "", height: 36 }, style: { desktop: { font: "heading", fontSize: 20, fontWeight: "700" } } },
  menu: { props: { links: "Shop | /products\nAbout | /about\nContact | /contact", mobile: "hamburger" }, style: { desktop: { gap: 24, fontSize: 14, fontWeight: "500" } } },
  cart: { props: { showCount: true, size: 22 } },
  products: { props: { source: "latest", category: "", sort: "newest", limit: 8, columns: 4, columnsTablet: 3, columnsMobile: 2 }, style: { desktop: { gap: 24 }, mobile: { gap: 12 } } },
  "product-image": { props: { ratio: "square", link: true, badges: true, zoom: true }, style: { desktop: { radius: 8 } } },
  "product-name": { props: { link: true }, style: { desktop: { fontSize: 14, fontWeight: "500" } } },
  "product-price": { props: { compare: true }, style: { desktop: { fontSize: 14, fontWeight: "600" } } },
  "product-button": { props: { text: "Add to cart", action: "add", variant: "solid", size: "sm", align: "full" } },
};

/** One product card design: image, name, price and an add-to-cart button. */
export function createProductCard(opts: { align?: "left" | "center"; ratio?: string; button?: boolean } = {}): LayoutNode {
  const center = opts.align === "center";
  return createNode("container", {
    style: { desktop: { direction: "column", gap: 8, padding: { t: 0, r: 0, b: 0, l: 0, u: "px" }, ...(center ? { align: "center", textAlign: "center" } : {}) } },
    children: [
      createNode("product-image", { props: { ...ELEMENT_DEFAULTS["product-image"].props, ratio: opts.ratio ?? "square" }, style: { desktop: { radius: 8, alignSelf: "stretch" } } }),
      createNode("product-name"),
      createNode("product-price"),
      ...(opts.button === false ? [] : [createNode("product-button")]),
    ],
  });
}

/** A product grid element with its card design. */
export function createProductGrid(props: LayoutNode["props"] = {}, card?: Parameters<typeof createProductCard>[0]): LayoutNode {
  return createNode("products", { props: { ...ELEMENT_DEFAULTS.products.props, ...props }, children: [createProductCard(card)] });
}

/** Field name from a label: "Phone number" → "phone_number". */
export function fieldNameFrom(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";
}

/** A ready-to-use contact form. */
export function createForm(): LayoutNode {
  return createNode("form", {
    children: [
      createNode("input", { props: { label: "Your name", name: "name", required: true } }),
      createNode("input", { props: { label: "Email", name: "email", inputType: "email", required: true } }),
      createNode("textarea", { props: { label: "Message", name: "message", required: true } }),
      createNode("button", { props: { text: "Send message", action: "submit" } }),
    ],
  });
}

/** True when `node` sits inside a form somewhere in `nodes`. */
export function insideForm(nodes: LayoutNode[], id: string): boolean {
  return (nodePath(nodes, id) ?? []).some((n) => n.type === "form");
}

export function createNode(type: NodeType, overrides: Partial<LayoutNode> = {}): LayoutNode {
  const d = ELEMENT_DEFAULTS[type];
  return {
    id: newNodeId(type),
    type,
    props: { ...d.props, ...overrides.props },
    ...(d.style || overrides.style ? { style: structuredClone(overrides.style ?? d.style) } : {}),
    ...(PARENT_TYPES.has(type) ? { children: overrides.children ?? [] } : {}),
    ...(overrides.conditions?.length ? { conditions: structuredClone(overrides.conditions) } : {}),
  };
}

export type ContainerPreset = { key: string; label: string; columns: number[] };

/** Column layouts offered in the element panel (numbers are flex-grow ratios). */
export const CONTAINER_PRESETS: ContainerPreset[] = [
  { key: "1", label: "1 column", columns: [1] },
  { key: "2", label: "2 columns", columns: [1, 1] },
  { key: "3", label: "3 columns", columns: [1, 1, 1] },
  { key: "4", label: "4 columns", columns: [1, 1, 1, 1] },
  { key: "30-70", label: "30 / 70", columns: [3, 7] },
  { key: "70-30", label: "70 / 30", columns: [7, 3] },
];

/** A boxed row of equal (or weighted) columns that stack on mobile. */
export function createColumns(columns: number[]): LayoutNode {
  if (columns.length === 1) {
    return createNode("container", { props: { contentWidth: "boxed" }, children: [createNode("heading"), createNode("text")] });
  }
  return createNode("container", {
    props: { contentWidth: "boxed" },
    style: {
      desktop: { direction: "row", gap: 24, align: "stretch", padding: { t: 32, r: 16, b: 32, l: 16, u: "px" } },
      mobile: { direction: "column" },
    },
    children: columns.map((grow) =>
      createNode("container", {
        style: { desktop: { direction: "column", gap: 12, grow, padding: { t: 0, r: 0, b: 0, l: 0, u: "px" } } },
        children: [createNode("heading", { style: { desktop: { font: "heading", fontSize: 22, fontWeight: "600" } } }), createNode("text")],
      }),
    ),
  });
}

/** Wraps nodes in a new "custom" page section. */
export function createCustomSection(id: string, nodes: LayoutNode[]): Section {
  return { id, type: "custom", settings: {}, nodes };
}

/**
 * Bar-sized defaults for elements dropped into a header bar: containers lose
 * their page padding and a fresh empty container flows in a row; headings and
 * text get bar-sized type. Anything the merchant already styled is kept.
 */
export function compactForBar(node: LayoutNode): LayoutNode {
  const d = node.style?.desktop ?? {};
  let desktop: Style = d;
  if (PARENT_TYPES.has(node.type)) {
    desktop = { ...d, padding: { t: 0, r: 0, b: 0, l: 0, u: "px" }, gap: Math.min(d.gap ?? 8, 12) };
    if (!node.children?.length && node.type === "container") desktop = { ...desktop, direction: "row", align: "center" };
  } else if (node.type === "heading") desktop = { ...d, fontSize: Math.min(d.fontSize ?? 18, 18) };
  else if (node.type === "text") desktop = { ...d, fontSize: Math.min(d.fontSize ?? 14, 14) };
  return {
    ...node,
    props: node.type === "container" ? { ...node.props, contentWidth: "full" } : node.props,
    style: { ...node.style, desktop },
    children: node.children?.map(compactForBar),
  };
}

// ─── Grouping & arranging ──────────────────────────────────────────────────

/**
 * Wraps sibling nodes in a new row or column container, in their current
 * order, at the position of the first one. Returns null if they don't share
 * a parent (grouping across containers would be ambiguous).
 */
export function groupNodes(nodes: LayoutNode[], ids: string[], direction: "row" | "column"): { nodes: LayoutNode[]; groupId: string } | null {
  if (!ids.length) return null;
  const locs = ids.map((id) => findParent(nodes, id));
  if (locs.some((l) => !l) || new Set(locs.map((l) => l!.parent?.id ?? null)).size !== 1) return null;
  const parent = locs[0]!.parent;
  const list = parent ? parent.children ?? [] : nodes;
  const picked = list.filter((n) => ids.includes(n.id));
  const at = list.findIndex((n) => ids.includes(n.id));
  const group = createNode("container", {
    style: { desktop: { direction, gap: 12, padding: { t: 0, r: 0, b: 0, l: 0, u: "px" }, ...(direction === "row" ? { align: "center" as const } : {}) } },
    children: picked,
  });
  const rest = list.filter((n) => !ids.includes(n.id));
  rest.splice(at, 0, group);
  return { nodes: parent ? updateNode(nodes, parent.id, (p) => ({ ...p, children: rest })) : rest, groupId: group.id };
}

/** Replaces a container with its children (the reverse of grouping). */
export function ungroupNode(nodes: LayoutNode[], id: string): LayoutNode[] {
  const loc = findParent(nodes, id);
  const node = findNode(nodes, id);
  if (!loc || !node || node.type !== "container") return nodes;
  const list = loc.parent ? loc.parent.children ?? [] : nodes;
  const next = [...list.slice(0, loc.index), ...(node.children ?? []), ...list.slice(loc.index + 1)];
  return loc.parent ? updateNode(nodes, loc.parent.id, (p) => ({ ...p, children: next })) : next;
}

/** Moves a node to the first or last place among its siblings. */
export function moveToEdge(nodes: LayoutNode[], id: string, edge: "start" | "end"): LayoutNode[] {
  const loc = findParent(nodes, id);
  if (!loc) return nodes;
  const list = loc.parent ? loc.parent.children ?? [] : nodes;
  const node = list[loc.index];
  const rest = list.filter((n) => n.id !== id);
  const next = edge === "start" ? [node, ...rest] : [...rest, node];
  return loc.parent ? updateNode(nodes, loc.parent.id, (p) => ({ ...p, children: next })) : next;
}

/** Turns the header's menu links into the Menu element's "Label | /path" lines. */
export function menuLinesFrom(links: unknown): string {
  return (Array.isArray(links) ? links : [])
    .map((l) => (l && typeof l === "object" ? `${String((l as Record<string, unknown>).label ?? "").trim()} | ${String((l as Record<string, unknown>).href ?? "/").trim()}` : ""))
    .filter((l) => l.replace(/[|\s]/g, ""))
    .join("\n");
}

/**
 * A fully custom navigation bar that starts as a copy of the standard one:
 * logo · menu · (search, cart), all editable elements.
 */
export function starterBar(header: Section): LayoutNode {
  const st = header.settings;
  const right: LayoutNode[] = [];
  if (st.showSearch !== false) right.push(createNode("search", { props: { placeholder: "Search products…", buttonText: "", variant: "icon" } }));
  if (st.showCart !== false) right.push(createNode("cart"));
  return createNode("container", {
    props: { contentWidth: "boxed" },
    style: {
      desktop: { direction: "row", justify: "between", align: "center", gap: 24, minHeight: { v: Number(st.navHeight) || 64, u: "px" }, padding: { t: 8, r: 16, b: 8, l: 16, u: "px" } },
      mobile: { gap: 8, padding: { t: 6, r: 8, b: 6, l: 8, u: "px" } },
    },
    children: [
      createNode("logo", { props: { text: typeof st.logoText === "string" ? st.logoText : "", image: typeof st.logoImage === "string" ? st.logoImage : "" }, style: { desktop: { font: "heading", fontSize: 20, fontWeight: "700" }, mobile: { fontSize: 18 } } }),
      // On phones the menu button comes first: [☰] [logo] [icons].
      createNode("menu", { props: { links: menuLinesFrom(st.links) || "Shop | /products" }, style: { desktop: { gap: 24, fontSize: 14, fontWeight: "500" }, mobile: { order: -1 } } }),
      createNode("container", { style: { desktop: { direction: "row", align: "center", gap: 4, padding: { t: 0, r: 0, b: 0, l: 0, u: "px" } } }, children: right }),
    ],
  });
}

/**
 * Turns a ready-made Product grid section into a custom layout with the same
 * content, so every part (heading, cards, image, name, price, button) can be
 * edited, moved and restyled — and new elements added to the cards.
 */
export function productGridToCustom(section: Section, id: string): Section {
  const st = section.settings;
  const str = (k: string) => (typeof st[k] === "string" ? (st[k] as string) : "");
  const pad = ({ none: 0, sm: 24, md: 48, lg: 72 } as Record<string, number>)[str("paddingY")] ?? 72;
  const cols = Number(str("columns")) || 4;
  const cat = str("category");
  const heading = str("heading");
  const head: LayoutNode[] = [];
  if (heading || st.showViewAll === true) {
    head.push(createNode("container", {
      style: { desktop: { direction: "row", justify: "between", align: "end", gap: 16, padding: { t: 0, r: 0, b: 0, l: 0, u: "px" } } },
      children: [
        ...(heading ? [createNode("heading", { props: { text: heading, tag: "h2" }, style: { desktop: { font: "heading", fontSize: 30, fontWeight: "600", lineHeight: 1.2 }, mobile: { fontSize: 24 } } })] : []),
        ...(st.showViewAll === true ? [createNode("button", { props: { text: "View all", link: str("source") === "category" && cat ? `/collections/${cat}` : "/products", variant: "link", size: "sm" } })] : []),
      ],
    }));
  }
  const grid = createProductGrid(
    { source: str("source") || "latest", category: cat, sort: str("sort") || "newest", limit: Number(st.limit) || 8, columns: cols, columnsTablet: Math.min(cols, 3), columnsMobile: 2 },
    { align: str("cardAlign") === "center" ? "center" : "left", ratio: str("imageRatio") || "square", button: st.cardButton === true },
  );
  grid.style = { desktop: { gap: 24 }, mobile: { gap: 12 } };
  const bg = /^#[0-9a-fA-F]{6}$/.test(str("backgroundColor")) ? str("backgroundColor") : undefined;
  const fg = /^#[0-9a-fA-F]{6}$/.test(str("textColor")) ? str("textColor") : undefined;
  const root = createNode("container", {
    props: { contentWidth: "boxed" },
    style: { desktop: { direction: "column", gap: 32, padding: { t: pad, r: 16, b: pad, l: 16, u: "px" }, ...(bg ? { bg } : {}), ...(fg ? { color: fg } : {}) }, mobile: { padding: { t: Math.round(pad * 0.7), r: 16, b: Math.round(pad * 0.7), l: 16, u: "px" } } },
    children: [...head, grid],
  });
  return { id, type: "custom", settings: {}, nodes: [root], ...(section.style ? { style: section.style } : {}), ...(section.hidden ? { hidden: true } : {}) };
}
