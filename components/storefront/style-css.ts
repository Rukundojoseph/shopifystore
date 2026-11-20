import { fontStack, isFont } from "@/lib/editor/fonts";
import { UNITS, safeImage, type Device, type ResponsiveStyle, type Style } from "@/lib/editor/schema";

// Builds scoped CSS from the typed style objects (lib/editor/schema.ts).
// Values are re-checked here too: numbers are clamped, units and enums are
// looked up in fixed tables, colours must be hex or a theme token, and
// url() only ever contains safeImage() output with CSS-special chars escaped.
// Breakpoints are container queries on the storefront's @container root, so
// the editor's tablet/mobile canvases show the real responsive layout.

export const BREAKPOINTS = { tablet: 1024, mobile: 767 } as const;

const TOKENS: Record<string, string> = {
  primary: "var(--sf-primary)", secondary: "var(--sf-secondary)", bg: "var(--sf-bg)", text: "var(--sf-text)",
  white: "#ffffff", black: "#000000", transparent: "transparent",
};
const JUSTIFY: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", between: "space-between", around: "space-around", evenly: "space-evenly" };
const ALIGN: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch", baseline: "baseline", auto: "auto" };
const SHADOW: Record<string, string> = {
  none: "none",
  sm: "0 1px 3px rgba(0,0,0,.10)",
  md: "0 6px 16px rgba(0,0,0,.12)",
  lg: "0 14px 32px rgba(0,0,0,.16)",
  xl: "0 28px 56px rgba(0,0,0,.22)",
};
const UNIT_SET = new Set<string>(UNITS);
const ENUMS: Record<string, Set<string>> = {
  direction: new Set(["row", "column", "row-reverse", "column-reverse"]),
  textAlign: new Set(["left", "center", "right", "justify"]),
  textTransform: new Set(["none", "uppercase", "lowercase", "capitalize"]),
  fontWeight: new Set(["300", "400", "500", "600", "700", "800", "900"]),
  borderStyle: new Set(["solid", "dashed", "dotted", "none"]),
  position: new Set(["static", "relative", "absolute", "sticky"]),
  overflow: new Set(["visible", "hidden"]),
  bgSize: new Set(["cover", "contain", "auto"]),
  bgPosition: new Set(["center", "top", "bottom", "left", "right"]),
};

const fin = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v)) * 100) / 100 : undefined;
const pick = (key: string, v: unknown): string | undefined => (typeof v === "string" && ENUMS[key]?.has(v) ? v : undefined);

export function cssColor(c: unknown): string | undefined {
  if (typeof c !== "string") return undefined;
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  return TOKENS[c];
}

function cssLength(l: unknown): string | undefined {
  if (!l || typeof l !== "object") return undefined;
  const { v, u } = l as { v: unknown; u: unknown };
  const n = fin(v, -5000, 5000);
  return n !== undefined && typeof u === "string" && UNIT_SET.has(u) ? `${n}${u}` : undefined;
}

function cssBox(b: unknown): string | undefined {
  if (!b || typeof b !== "object") return undefined;
  const { t, r, b: bo, l, u } = b as Record<string, unknown>;
  if (typeof u !== "string" || !["px", "%", "em", "rem"].includes(u)) return undefined;
  const vals = [t, r, bo, l].map((x) => fin(x, -2000, 2000));
  return vals.some((x) => x === undefined) ? undefined : vals.map((x) => `${x}${u}`).join(" ");
}

export function cssUrl(src: unknown): string | undefined {
  const s = safeImage(src);
  if (!s) return undefined;
  return `url("${s.replace(/["'\\\n\r\f<>(){};]/g, (ch) => `\\${ch.charCodeAt(0).toString(16)} `)}")`;
}

type Decl = [string, string];
/**
 * Declarations grouped by which box they belong on (see `Rule.groups`):
 * layout (flex), outer (placement in the parent), box (padding, background,
 * border…) and text (typography). "skin" in a rule means box + text.
 */
export type DeclGroups = { layout: Decl[]; outer: Decl[]; box: Decl[]; text: Decl[] };
type GroupName = keyof DeclGroups | "skin";

export function styleDecls(s: Style): DeclGroups {
  const layout: Decl[] = [], outer: Decl[] = [], box: Decl[] = [], text: Decl[] = [];
  const skin = box;
  const add = (list: Decl[], prop: string, v: string | undefined) => { if (v !== undefined) list.push([prop, v]); };

  // Flex layout (on the element that holds the children)
  add(layout, "flex-direction", pick("direction", s.direction));
  add(layout, "justify-content", s.justify ? JUSTIFY[s.justify] : undefined);
  add(layout, "align-items", s.align ? ALIGN[s.align] : undefined);
  if (s.wrap !== undefined) add(layout, "flex-wrap", s.wrap ? "wrap" : "nowrap");
  const gap = fin(s.gap, 0, 400);
  add(layout, "gap", gap !== undefined ? `${gap}px` : undefined);

  // Placement in the parent
  const grow = fin(s.grow, 0, 12);
  if (grow !== undefined) add(outer, "flex", grow > 0 ? `${grow} 1 0%` : "0 0 auto");
  add(outer, "align-self", s.alignSelf ? ALIGN[s.alignSelf] : undefined);
  const order = fin(s.order, -20, 20);
  add(outer, "order", order !== undefined ? String(Math.round(order)) : undefined);
  add(outer, "margin", cssBox(s.margin));
  add(outer, "width", cssLength(s.width));
  add(outer, "max-width", cssLength(s.maxWidth));
  add(outer, "position", pick("position", s.position));
  add(outer, "top", cssLength(s.top));
  add(outer, "right", cssLength(s.right));
  add(outer, "bottom", cssLength(s.bottom));
  add(outer, "left", cssLength(s.left));
  const z = fin(s.zIndex, -10, 999);
  add(outer, "z-index", z !== undefined ? String(Math.round(z)) : undefined);
  const op = fin(s.opacity, 0, 100);
  add(outer, "opacity", op !== undefined ? String(op / 100) : undefined);

  // Box skin
  add(skin, "padding", cssBox(s.padding));
  add(skin, "min-height", cssLength(s.minHeight));
  add(skin, "height", cssLength(s.height));
  add(skin, "background-color", cssColor(s.bg));
  const url = cssUrl(s.bgImage);
  if (url) {
    const dim = fin(s.overlay, 0, 90);
    add(skin, "background-image", dim ? `linear-gradient(rgba(0,0,0,${dim / 100}),rgba(0,0,0,${dim / 100})),${url}` : url);
    add(skin, "background-size", pick("bgSize", s.bgSize) ?? "cover");
    add(skin, "background-position", pick("bgPosition", s.bgPosition) ?? "center");
    add(skin, "background-repeat", "no-repeat");
  }
  add(text, "color", cssColor(s.color));
  if (s.font === "heading" || s.font === "body") add(text, "font-family", s.font === "heading" ? "var(--sf-heading)" : "var(--sf-font)");
  else if (isFont(s.font)) add(text, "font-family", fontStack(s.font));
  const fs = fin(s.fontSize, 6, 200);
  add(text, "font-size", fs !== undefined ? `${fs}px` : undefined);
  add(text, "font-weight", pick("fontWeight", s.fontWeight));
  const lh = fin(s.lineHeight, 0.5, 4);
  add(text, "line-height", lh !== undefined ? String(lh) : undefined);
  const ls = fin(s.letterSpacing, -5, 30);
  add(text, "letter-spacing", ls !== undefined ? `${ls}px` : undefined);
  add(text, "text-align", pick("textAlign", s.textAlign));
  add(text, "text-transform", pick("textTransform", s.textTransform));
  if (s.italic !== undefined) add(text, "font-style", s.italic ? "italic" : "normal");
  const rad = fin(s.radius, 0, 999);
  add(skin, "border-radius", rad !== undefined ? `${rad}px` : undefined);
  const bw = fin(s.borderWidth, 0, 50);
  if (bw !== undefined) add(skin, "border-width", `${bw}px`);
  // A chosen style (incl. "none" to remove a default border) applies on its own.
  const bs = pick("borderStyle", s.borderStyle) ?? (bw !== undefined ? "solid" : undefined);
  add(skin, "border-style", bs);
  add(skin, "border-color", cssColor(s.borderColor));
  add(skin, "box-shadow", s.shadow ? SHADOW[s.shadow] : undefined);
  add(skin, "overflow", pick("overflow", s.overflow));

  return { layout, outer, box, text };
}

export type Rule = { sel: string; groups: GroupName[]; important?: boolean };

const expand = (groups: GroupName[]): (keyof DeclGroups)[] => groups.flatMap((g) => (g === "skin" ? (["box", "text"] as const) : [g]));

const RANGE: Record<Device, string> = {
  desktop: `(min-width:${BREAKPOINTS.tablet + 1}px)`,
  tablet: `(min-width:${BREAKPOINTS.mobile + 1}px) and (max-width:${BREAKPOINTS.tablet}px)`,
  mobile: `(max-width:${BREAKPOINTS.mobile}px)`,
};

/**
 * CSS for one styled element. `rules` say which selector receives which
 * declaration groups (e.g. a boxed container puts `layout` on its inner box).
 * `hideSel` gets display:none on devices where the element is hidden; in the
 * editor it is dimmed instead so it can still be selected.
 */
export function buildCss(rs: ResponsiveStyle | undefined, rules: Rule[], hideSel: string, editing = false): string {
  if (!rs) return "";
  const out: string[] = [];
  for (const device of ["desktop", "tablet", "mobile"] as const) {
    const st = rs[device];
    if (!st) continue;
    const g = styleDecls(st);
    const body = rules
      .map((r) => {
        const decls = expand(r.groups).flatMap((k) => g[k]);
        return decls.length ? `${r.sel}{${decls.map(([p, v]) => `${p}:${v}${r.important ? "!important" : ""}`).join(";")}}` : "";
      })
      .join("");
    if (body) out.push(device === "desktop" ? body : `@container (max-width:${BREAKPOINTS[device]}px){${body}}`);
  }
  // Visibility uses exact ranges so "hidden on desktop" needs no undo rule below it.
  let hidden = false;
  for (const device of ["desktop", "tablet", "mobile"] as const) {
    if (rs[device]?.hidden !== undefined) hidden = !!rs[device]!.hidden;
    if (hidden) out.push(`@container ${RANGE[device]}{${hideSel}{${editing ? "opacity:.35!important;outline:1px dashed #a1a1aa" : "display:none!important"}}}`);
  }
  return out.join("");
}

/**
 * One style layer with no breakpoints (used by conditions, which supply their
 * own selector or @container wrapper). Hidden means display:none, or dimmed
 * in the editor.
 */
export function buildPlainCss(style: Style, rules: Rule[], hideSel: string, editing = false): string {
  const g = styleDecls(style);
  let css = rules
    .map((r) => {
      const decls = expand(r.groups).flatMap((k) => g[k]);
      return decls.length ? `${r.sel}{${decls.map(([p, v]) => `${p}:${v}`).join(";")}}` : "";
    })
    .join("");
  if (style.hidden) css += `${hideSel}{${editing ? "opacity:.35!important;outline:1px dashed #a1a1aa" : "display:none!important"}}`;
  return css;
}
