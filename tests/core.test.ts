import { describe, expect, it } from "vitest";
import { normalizeRwandaPhone, isMtnNumber, formatRwandaPhone } from "@/lib/phone";
import { deliveryFeeFor, formatMoney } from "@/lib/money";
import { isValidStoreSlug, slugify } from "@/lib/slug";
import { safeHref, safeImage, siteConfigSchema } from "@/lib/editor/schema";
import { SECTION_DEFS, createSection } from "@/lib/editor/sections";
import { TEMPLATES, buildSiteConfig } from "@/templates";
import { mapRemoteStatus } from "@/lib/payments/momo";
import { sniffImage } from "@/lib/storage";

describe("phone numbers", () => {
  it("normalises Rwandan mobile formats", () => {
    expect(normalizeRwandaPhone("078 812 3456")).toBe("250788123456");
    expect(normalizeRwandaPhone("+250 788 123 456")).toBe("250788123456");
    expect(normalizeRwandaPhone("788123456")).toBe("250788123456");
    expect(normalizeRwandaPhone("0731234567")).toBe("250731234567");
  });
  it("rejects non-mobile numbers", () => {
    expect(normalizeRwandaPhone("0123456789")).toBeNull();
    expect(normalizeRwandaPhone("0751234567")).toBeNull();
    expect(normalizeRwandaPhone("12345")).toBeNull();
  });
  it("identifies MTN numbers", () => {
    expect(isMtnNumber("250788123456")).toBe(true);
    expect(isMtnNumber("250791234567")).toBe(true);
    expect(isMtnNumber("250731234567")).toBe(false);
    expect(formatRwandaPhone("250788123456")).toBe("0788 123 456");
  });
});

describe("money", () => {
  it("formats RWF without decimals", () => expect(formatMoney(15000)).toMatch(/15,000/));
  it("applies the free-delivery threshold", () => {
    expect(deliveryFeeFor(49_999, { deliveryFee: 2000, freeDeliveryOver: 50_000 })).toBe(2000);
    expect(deliveryFeeFor(50_000, { deliveryFee: 2000, freeDeliveryOver: 50_000 })).toBe(0);
    expect(deliveryFeeFor(10, { deliveryFee: 1500, freeDeliveryOver: null })).toBe(1500);
  });
});

describe("store slugs", () => {
  it("slugifies names", () => expect(slugify("Kigali Fashion & Co.")).toBe("kigali-fashion-co"));
  it("blocks reserved and malformed slugs", () => {
    expect(isValidStoreSlug("kigalifashion")).toBe(true);
    expect(isValidStoreSlug("admin")).toBe(false);
    expect(isValidStoreSlug("a")).toBe(false);
    expect(isValidStoreSlug("-bad")).toBe(false);
  });
});

describe("website builder config", () => {
  it.each(TEMPLATES.map((t) => t.key))("template %s produces a valid config", (key) => {
    const cfg = buildSiteConfig(key, "Test Store");
    expect(siteConfigSchema.safeParse(cfg).success).toBe(true);
    expect(cfg.pages.find((p) => p.slug === "/")).toBeTruthy();
  });
  it("every section type can be created with defaults", () => {
    for (const d of SECTION_DEFS) expect(createSection(d.type).settings).toEqual(expect.objectContaining(d.defaults));
  });
  it("rejects HTML-ish / malformed configs", () => {
    const cfg = buildSiteConfig("general", "X");
    expect(siteConfigSchema.safeParse({ ...cfg, theme: { ...cfg.theme, primaryColor: "red;background:url(x)" } }).success).toBe(false);
    expect(siteConfigSchema.safeParse({ ...cfg, pages: [] }).success).toBe(false);
  });
  it("only renders safe links and images", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("//evil.com")).toBe("#");
    expect(safeHref("/products")).toBe("/products");
    expect(safeHref("https://wa.me/250788")).toBe("https://wa.me/250788");
    expect(safeImage("http://insecure.example/x.png")).toBeNull();
    expect(safeImage("data:image/svg+xml,<svg>")).toBeNull();
    expect(safeImage("/uploads/a/b.png")).toBe("/uploads/a/b.png");
  });
});

describe("MTN status mapping", () => {
  it("maps final statuses", () => {
    expect(mapRemoteStatus({ status: "SUCCESSFUL" })).toBe("successful");
    expect(mapRemoteStatus({ status: "PENDING" })).toBe("processing");
    expect(mapRemoteStatus({ status: "FAILED", reason: "APPROVAL_REJECTED" })).toBe("cancelled");
    expect(mapRemoteStatus({ status: "FAILED", reason: "EXPIRED" })).toBe("expired");
    expect(mapRemoteStatus({ status: "FAILED", reason: { code: "INTERNAL_PROCESSING_ERROR" } })).toBe("failed");
  });
});

describe("upload validation", () => {
  it("detects real image types by magic bytes", () => {
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.mime).toBe("image/png");
    expect(sniffImage(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });
});

describe("store host routing", async () => {
  const { storeKeyFromHost, STORE_HOST_APP_PATHS } = await import("@/lib/tenants/host");
  it("maps subdomains and custom domains to a store key", () => {
    expect(storeKeyFromHost("kigalifashion.localhost:3000")).toBe("kigalifashion");
    expect(storeKeyFromHost("shop.example.rw")).toBe("shop.example.rw");
    expect(storeKeyFromHost("localhost:3000")).toBeNull();
    expect(storeKeyFromHost("www.localhost:3000")).toBeNull();
    expect(storeKeyFromHost("a.b.localhost:3000")).toBeNull();
  });
  it("serves the owner dashboard on store domains but not admin/onboarding", () => {
    for (const p of ["/dashboard", "/dashboard/orders", "/dashboard/payments", "/store-builder/editor", "/login"]) expect(STORE_HOST_APP_PATHS.test(p)).toBe(true);
    for (const p of ["/admin", "/onboarding", "/register", "/dashboards", "/"]) expect(STORE_HOST_APP_PATHS.test(p)).toBe(false);
  });
});

describe("custom layout builder", async () => {
  const { sectionSchema } = await import("@/lib/editor/schema");
  const nodes = await import("@/lib/editor/nodes");
  const { buildCss, cssUrl } = await import("@/components/storefront/style-css");
  const { treeCss } = await import("@/components/storefront/nodes");

  it("keeps every built-in template valid with the extended schema", () => {
    for (const t of TEMPLATES) expect(siteConfigSchema.safeParse(buildSiteConfig(t.key, "Test", null)).success).toBe(true);
  });

  it("accepts column presets and enforces depth / size limits", () => {
    for (const p of nodes.CONTAINER_PRESETS) {
      expect(sectionSchema.safeParse(nodes.createCustomSection("custom-a", [nodes.createColumns(p.columns)])).success).toBe(true);
    }
    let deep = nodes.createNode("heading");
    for (let i = 0; i < 7; i++) deep = nodes.createNode("container", { children: [deep] });
    expect(sectionSchema.safeParse(nodes.createCustomSection("custom-b", [deep])).success).toBe(false);
    const wide = Array.from({ length: 6 }, () => nodes.createNode("container", { children: Array.from({ length: 55 }, () => nodes.createNode("text")) }));
    expect(sectionSchema.safeParse(nodes.createCustomSection("custom-c", wide)).success).toBe(false);
  });

  it("rejects CSS injection at the schema and never emits it", () => {
    const bad = { desktop: { bg: "red;}body{display:none", padding: { t: 1, r: 1, b: 1, l: 1, u: "px;}x{" } } };
    expect(sectionSchema.safeParse({ id: "x", type: "text", settings: {}, style: bad }).success).toBe(false);
    // Even if unvalidated data reached the renderer, nothing unsafe is printed.
    const css = buildCss(bad as never, [{ sel: ".n-x", groups: ["layout", "outer", "skin"] }], ".n-x");
    expect(css).not.toContain("body");
    expect(css).not.toContain("}x{");
    expect(cssUrl("javascript:alert(1)")).toBeUndefined();
    expect(cssUrl('https://a.example/x.png");}body{')).not.toMatch(/["}{]\s*body/);
  });

  it("emits desktop-first responsive CSS and device-ranged hiding", () => {
    const n = nodes.createNode("container", { style: { desktop: { direction: "row", gap: 24 }, mobile: { direction: "column", hidden: true } } });
    const css = treeCss([n]);
    expect(css).toContain(`.n-${n.id}{flex-direction:row;gap:24px}`);
    expect(css).toContain(`@container (max-width:767px){.n-${n.id}{flex-direction:column}}`);
    expect(css).toMatch(/@container \(max-width:767px\)\{\.n-[^{]+\{display:none!important/);
    expect(css).not.toMatch(/min-width:1025px\)\{\.n-[^{]+\{display:none/);
  });

  it("moves, duplicates and removes nodes immutably", () => {
    const tree = [nodes.createColumns([1, 1])];
    const [left, right] = tree[0].children!;
    const heading = left.children![0];
    const moved = nodes.moveNode(tree, heading.id, right.id, "inside");
    expect(nodes.findParent(moved, heading.id)?.parent?.id).toBe(right.id);
    expect(nodes.findNode(tree, heading.id)).toBe(heading); // original untouched
    expect(nodes.moveNode(tree, tree[0].id, left.id, "inside")).toBe(tree); // no drop into own descendant
    const { nodes: dup, copyId } = nodes.duplicateNode(tree, left.id);
    expect(copyId).not.toBe(left.id);
    expect(nodes.findNode(dup, copyId!)?.children?.[0].id).not.toBe(heading.id);
    expect(nodes.countNodes(nodes.removeNode(tree, left.id))).toBe(nodes.countNodes(tree) - 3);
  });

  it("cascades responsive styles and clears empty layers", () => {
    let rs = nodes.setStyleValue(undefined, "desktop", "gap", 10);
    rs = nodes.setStyleValue(rs, "mobile", "gap", 4);
    expect(nodes.effectiveStyle(rs, "tablet").gap).toBe(10);
    expect(nodes.effectiveStyle(rs, "mobile").gap).toBe(4);
    expect(nodes.styleSource(rs, "tablet", "gap")).toBe("desktop");
    expect(nodes.setStyleValue(nodes.setStyleValue(rs, "mobile", "gap", undefined), "desktop", "gap", undefined)).toBeUndefined();
  });
});

describe("conditions, workflows and shop pages", async () => {
  const { sectionSchema, workflowSchema, siteConfigSchema: cfg } = await import("@/lib/editor/schema");
  const nodes = await import("@/lib/editor/nodes");
  const { treeCss } = await import("@/components/storefront/nodes");
  const { defaultSystemSections } = await import("@/lib/editor/sections");

  it("compiles conditions to scoped CSS", () => {
    const n = nodes.createNode("button", {
      conditions: [
        { id: "c1", when: { type: "hover" }, style: { bg: "primary" } },
        { id: "c2", when: { type: "clicked" }, style: { color: "#ff0000" } },
        { id: "c3", when: { type: "width", max: 600 }, style: { hidden: true } },
        { id: "c4", when: { type: "scrolled", offset: 250 }, style: { opacity: 50 } },
      ],
    });
    const css = treeCss([n]);
    expect(css).toContain(`.n-${n.id}:hover>.sf-btn{background-color:var(--sf-primary)}`);
    expect(css).toContain(`[data-sf-states~="${n.id}"] .n-${n.id}>.sf-btn{color:#ff0000}`);
    expect(css).toContain(`@container (max-width:600px){.n-${n.id}{display:none!important}}`);
    expect(css).toContain(`[data-sf-scroll~="250"] .n-${n.id}{opacity:0.5}`);
    // In the editor each condition can also be previewed via the canvas flag.
    expect(treeCss([n], true)).toContain(`[data-sf-preview~="c1"] .n-${n.id}>.sf-btn`);
  });

  it("rejects forms inside forms", () => {
    const inner = nodes.createForm();
    const outer = nodes.createNode("form", { children: [inner] });
    expect(sectionSchema.safeParse(nodes.createCustomSection("custom-f", [outer])).success).toBe(false);
    expect(sectionSchema.safeParse(nodes.createCustomSection("custom-g", [nodes.createForm()])).success).toBe(true);
  });

  it("validates workflows strictly", () => {
    const ok = { id: "wf-1", name: "Cancel", trigger: { type: "submit", nodeId: "form-1" }, actions: [{ id: "a-1", type: "cancelOrder", orderField: "order" }, { id: "a-2", type: "showMessage", text: "Done" }] };
    expect(workflowSchema.safeParse(ok).success).toBe(true);
    expect(workflowSchema.safeParse({ ...ok, actions: [{ id: "a-1", type: "runSql", sql: "drop table orders" }] }).success).toBe(false);
    expect(workflowSchema.safeParse({ ...ok, actions: [{ id: "a-1", type: "cancelOrder", orderField: "x'; --" }] }).success).toBe(false);
    expect(workflowSchema.safeParse({ ...ok, trigger: { type: "click", nodeId: "</style>" } }).success).toBe(false);
  });

  it("accepts shop page layouts and workflows in the site config", () => {
    const base = buildSiteConfig("general", "Test", null);
    const shop = [nodes.createCustomSection("custom-banner", [nodes.createColumns([1])]), ...defaultSystemSections("shop")];
    expect(cfg.safeParse({ ...base, systemPages: { shop }, workflows: [] }).success).toBe(true);
  });
});

describe("header elements", async () => {
  const { sectionSchema } = await import("@/lib/editor/schema");
  const nodes = await import("@/lib/editor/nodes");
  const { createSection } = await import("@/lib/editor/sections");

  it("accepts the merchant's own elements in both header bars", () => {
    const header = { ...createSection("header", { topBar: true, topBarMode: "custom", navElements: true }), nodes: [nodes.createColumns([1, 1])], navNodes: [nodes.createNode("container", { children: [nodes.createNode("button"), nodes.createColumns([1, 1])] })] };
    expect(sectionSchema.safeParse(header).success).toBe(true);
  });

  it("applies the size limit across both bars together", () => {
    const many = (n: number) => Array.from({ length: n }, () => nodes.createNode("text"));
    const header = { ...createSection("header"), nodes: [nodes.createNode("container", { children: many(55) }), nodes.createNode("container", { children: many(55) }), nodes.createNode("container", { children: many(55) })], navNodes: [nodes.createNode("container", { children: many(55) }), nodes.createNode("container", { children: many(55) }), nodes.createNode("container", { children: many(55) })] };
    expect(sectionSchema.safeParse(header).success).toBe(false);
  });
});

describe("compact header elements", async () => {
  const nodes = await import("@/lib/editor/nodes");
  it("gives elements dropped into a bar compact defaults", () => {
    const box = nodes.compactForBar(nodes.createNode("container"));
    expect(box.style?.desktop).toMatchObject({ direction: "row", padding: { t: 0, r: 0, b: 0, l: 0 } });
    const cols = nodes.compactForBar(nodes.createColumns([1, 1]));
    expect(cols.props.contentWidth).toBe("full");
    expect(cols.children?.[0].children?.[0].style?.desktop?.fontSize).toBeLessThanOrEqual(18);
  });
});

describe("grouping, placement and custom navigation", async () => {
  const nodes = await import("@/lib/editor/nodes");
  const { treeCss } = await import("@/components/storefront/nodes");
  const fontsMod = await import("@/lib/editor/fonts");
  const { sectionSchema } = await import("@/lib/editor/schema");
  const { createSection } = await import("@/lib/editor/sections");

  it("groups siblings into a row/column and ungroups them again", () => {
    const [a, b, c] = [nodes.createNode("heading"), nodes.createNode("text"), nodes.createNode("button")];
    const tree = [nodes.createNode("container", { children: [a, b, c] })];
    const res = nodes.groupNodes(tree, [c.id, a.id], "row")!;
    const outer = res.nodes[0];
    expect(outer.children!.map((n) => n.id)).toEqual([res.groupId, b.id]);
    const group = outer.children![0];
    expect(group.children!.map((n) => n.id)).toEqual([a.id, c.id]); // keeps document order
    expect(group.style?.desktop?.direction).toBe("row");
    expect(nodes.groupNodes(res.nodes, [a.id, b.id], "row")).toBeNull(); // different containers
    expect(nodes.ungroupNode(res.nodes, res.groupId)[0].children!.map((n) => n.id)).toEqual([a.id, c.id, b.id]);
    expect(nodes.moveToEdge(tree, c.id, "start")[0].children![0].id).toBe(c.id);
  });

  it("pushes elements along the parent's direction on each device", () => {
    const child = nodes.createNode("button", { style: { desktop: { push: "end" } } });
    const parent = nodes.createNode("container", { style: { desktop: { direction: "row" }, mobile: { direction: "column" } }, children: [child] });
    const css = treeCss([parent]);
    expect(css).toContain(`.n-${child.id}{margin:0px 0px 0px auto}`);
    expect(css).toContain(`@container (max-width:767px){.n-${child.id}{margin:auto 0px 0px 0px}}`);
  });

  it("styles a field's box and can remove its border", () => {
    const input = nodes.createNode("input", { style: { desktop: { borderStyle: "none", radius: 12, color: "#ff0000" } } });
    const css = treeCss([input]);
    expect(css).toContain(`.n-${input.id} .sf-input{border-radius:12px;border-style:none;color:#ff0000}`);
    expect(css).toContain(`.n-${input.id}{color:#ff0000}`); // label colour too
  });

  it("builds a valid fully custom navigation bar from the standard one", () => {
    const header = createSection("header", { links: [{ label: "Shop", href: "/products" }, { label: "Sale", href: "/collections/sale" }] });
    const bar = nodes.starterBar(header);
    const types: string[] = [];
    const walk = (n: typeof bar) => { types.push(n.type); n.children?.forEach(walk); };
    walk(bar);
    expect(types).toEqual(expect.arrayContaining(["logo", "menu", "search", "cart"]));
    expect(bar.children![1].props.links).toBe("Shop | /products\nSale | /collections/sale");
    expect(sectionSchema.safeParse({ ...header, settings: { ...header.settings, navMode: "custom" }, barNodes: [bar] }).success).toBe(true);
  });

  it("gives an element its own font from the list, never free text", () => {
    const h = nodes.createNode("heading", { style: { desktop: { font: "Playfair Display" }, mobile: { font: "Pacifico" } } });
    const css = treeCss([h]);
    expect(css).toContain('font-family:"Playfair Display",serif');
    expect(css).toContain('font-family:"Pacifico",cursive');
    const bad = nodes.createNode("text", { style: { desktop: { font: "Comic;}body{display:none" as never } } });
    expect(sectionSchema.safeParse(nodes.createCustomSection("custom-f", [bad])).success).toBe(false);
    const { fontsInDesign } = fontsMod;
    expect(fontsInDesign({ pages: [{ sections: [{ nodes: [h] }] }] }).sort()).toEqual(["Pacifico", "Playfair Display"]);
  });

  it("repeats a product grid's card and sets columns per device", () => {
    const grid = nodes.createProductGrid({ columns: 3, columnsMobile: 1 });
    expect(grid.children![0].children!.map((n) => n.type)).toEqual(["product-image", "product-name", "product-price", "product-button"]);
    const css = treeCss([grid]);
    expect(css).toContain(`.n-${grid.id}>.sf-grid{grid-template-columns:repeat(3,minmax(0,1fr))}`);
    expect(css).toContain(`@container (max-width:767px){.n-${grid.id}>.sf-grid{grid-template-columns:repeat(1,minmax(0,1fr))}}`);
    expect(sectionSchema.safeParse(nodes.createCustomSection("custom-g", [grid])).success).toBe(true);
  });

  it("turns a Product grid section into an editable custom layout", () => {
    const src = createSection("product-grid", { heading: "Best sellers", columns: "3", cardAlign: "center", cardButton: true, backgroundColor: "#f5f5f5" });
    const out = nodes.productGridToCustom(src, "custom-pg");
    expect(sectionSchema.safeParse(out).success).toBe(true);
    const root = out.nodes![0];
    expect(root.style?.desktop?.bg).toBe("#f5f5f5");
    const grid = root.children!.find((n) => n.type === "products")!;
    expect(grid.props.columns).toBe(3);
    expect(grid.children![0].style?.desktop?.textAlign).toBe("center");
    expect(grid.children![0].children!.some((n) => n.type === "product-button")).toBe(true);
    expect(root.children![0].children![0].props.text).toBe("Best sellers");
  });

  it("gives a field border without a colour a soft default colour", () => {
    const input = nodes.createNode("input", { style: { desktop: { borderWidth: 1 } } });
    const css = treeCss([input]);
    expect(css.indexOf(`.n-${input.id} .sf-input{border-color:rgb(0 0 0 / .2)}`)).toBeGreaterThanOrEqual(0);
    expect(css).toContain("border-style:solid");
  });

  it("clones copied elements with fresh ids", () => {
    const tree = nodes.createColumns([1, 1]);
    const copy = nodes.cloneNode(tree);
    const ids = (n: typeof tree): string[] => [n.id, ...(n.children ?? []).flatMap(ids)];
    expect(ids(copy).some((x) => ids(tree).includes(x))).toBe(false);
    expect(ids(copy).length).toBe(ids(tree).length);
  });
});


describe("custom Tailwind classes", async () => {
  const { sectionSchema } = await import("@/lib/editor/schema");
  const nodes = await import("@/lib/editor/nodes");
  const tw = await import("@/lib/editor/tailwind");
  const { tailwindCss } = await import("@/lib/storefront/tailwind-css");

  it("accepts class names and rejects anything that isn't one", () => {
    expect(tw.twClasses("p-4  hover:bg-primary @3xl:flex-row rounded-[13px] bg-[url(https://x.y/a.png)] a;b{}")).toEqual(["p-4", "hover:bg-primary", "@3xl:flex-row", "rounded-[13px]"]);
    const ok = nodes.createNode("text", {});
    expect(sectionSchema.safeParse(nodes.createCustomSection("custom-t", [{ ...ok, tw: "shadow-xl ring-2" }])).success).toBe(true);
    expect(sectionSchema.safeParse(nodes.createCustomSection("custom-u", [{ ...ok, tw: "p-4 }body{display:none" }])).success).toBe(false);
    expect(sectionSchema.safeParse(nodes.createCustomSection("custom-v", [{ ...ok, tw: "bg-[url(//evil.example/x)]" }])).success).toBe(false);
    expect(tw.twInDesign({ pages: [{ sections: [{ tw: "mt-4", nodes: [{ ...ok, tw: "p-4 mt-4" }] }] }] })).toEqual(["mt-4", "p-4"]);
  });

  it("compiles them with store colours, scoped theme variables and !important", async () => {
    const css = await tailwindCss(["bg-primary p-8 hover:bg-red-500 @3xl:flex font-heading"]);
    expect(css).toContain("background-color: var(--sf-primary) !important");
    expect(css).toContain("font-family: var(--sf-heading) !important");
    expect(css).toContain("@container");
    expect(css).toContain(".sf-tw {");
    expect(css).not.toContain(":root");
    expect(await tailwindCss([])).toBe("");
  });
});
