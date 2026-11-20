"use client";

import { useState, type CSSProperties } from "react";
import {
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalSpaceBetween, AlignHorizontalSpaceAround,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, StretchHorizontal, ArrowRight, ArrowDown, ArrowLeft, ArrowUp,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Bookmark, Copy, CornerLeftUp, Trash2, ChevronRight, Zap,
  ChevronsLeft, ChevronLeft, ChevronsRight, Columns2, Rows2, Ungroup, ClipboardCopy, ClipboardPaste,
} from "lucide-react";
import { PARENT_TYPES, type Device, type LayoutNode, type ResponsiveStyle, type Section, type Style } from "@/lib/editor/schema";
import { DEVICES, effectiveStyle, styleSource } from "@/lib/editor/nodes";
import { FONT_GROUPS } from "@/lib/editor/fonts";
import { MAX_TW_LENGTH, invalidTwTokens } from "@/lib/editor/tailwind";
import { NODE_ICONS } from "@/components/storefront/nodes";
import { cn } from "@/components/ui";
import { BoxInput, ButtonGroup, ColorInput, DEVICE_ICON, Field, Group, LengthInput, NumberInput, Tabs, Toggle, inputCls, type Box, type Length } from "./controls";
import { ImageField, LinkField, SectionProperties, type LinkOption } from "./properties";

export type StyleSetter = <K extends keyof Style>(key: K, value: Style[K] | undefined, device?: Device) => void;

type Api = { rs: ResponsiveStyle | undefined; device: Device; set: StyleSetter; themeVars: CSSProperties };

/** Binds one style key: current (cascaded) value, where it comes from, setter, reset. */
function useKey(api: Api) {
  const eff = effectiveStyle(api.rs, api.device);
  return <K extends keyof Style>(key: K) => ({
    value: eff[key],
    source: styleSource(api.rs, api.device, key),
    set: (v: Style[K] | undefined) => api.set(key, v),
    reset: () => api.set(key, undefined),
    device: api.device,
  });
}

function F({ b, label, inline, children }: { b: { source: Device | null; reset: () => void; device: Device }; label: string; inline?: boolean; children: React.ReactNode }) {
  return <Field label={label} device={b.device} source={b.source} onReset={b.reset} inline={inline}>{children}</Field>;
}

const ico = "h-3.5 w-3.5";

// ─── Layout (containers) ──────────────────────────────────────────────────

export function LayoutGroup({ api }: { api: Api }) {
  const k = useKey(api);
  const dir = k("direction"), justify = k("justify"), align = k("align"), wrap = k("wrap"), gap = k("gap");
  const row = String(dir.value ?? "column").startsWith("row");
  return (
    <Group title="Layout">
      <F b={dir} label="Direction">
        <ButtonGroup value={dir.value ?? "column"} onChange={dir.set} options={[
          { value: "row", label: "Row (horizontal)", icon: <ArrowRight className={ico} /> },
          { value: "column", label: "Column (vertical)", icon: <ArrowDown className={ico} /> },
          { value: "row-reverse", label: "Row reversed", icon: <ArrowLeft className={ico} /> },
          { value: "column-reverse", label: "Column reversed", icon: <ArrowUp className={ico} /> },
        ]} />
      </F>
      <F b={justify} label={row ? "Justify (horizontal)" : "Justify (vertical)"}>
        <ButtonGroup value={justify.value} onChange={justify.set} options={[
          { value: "start", label: "Start", icon: <AlignHorizontalJustifyStart className={cn(ico, !row && "rotate-90")} /> },
          { value: "center", label: "Center", icon: <AlignHorizontalJustifyCenter className={cn(ico, !row && "rotate-90")} /> },
          { value: "end", label: "End", icon: <AlignHorizontalJustifyEnd className={cn(ico, !row && "rotate-90")} /> },
          { value: "between", label: "Space between", icon: <AlignHorizontalSpaceBetween className={cn(ico, !row && "rotate-90")} /> },
          { value: "around", label: "Space around", icon: <AlignHorizontalSpaceAround className={cn(ico, !row && "rotate-90")} /> },
          { value: "evenly", label: "Space evenly", icon: <span className="text-[10px] font-bold">≡</span> },
        ]} />
      </F>
      <F b={align} label={row ? "Align (vertical)" : "Align (horizontal)"}>
        <ButtonGroup value={align.value} onChange={align.set} options={[
          { value: "start", label: "Start", icon: <AlignStartHorizontal className={cn(ico, !row && "-rotate-90")} /> },
          { value: "center", label: "Center", icon: <AlignCenterHorizontal className={cn(ico, !row && "-rotate-90")} /> },
          { value: "end", label: "End", icon: <AlignEndHorizontal className={cn(ico, !row && "-rotate-90")} /> },
          { value: "stretch", label: "Stretch", icon: <StretchHorizontal className={cn(ico, row && "rotate-90")} /> },
        ]} />
      </F>
      <F b={gap} label="Gap between elements">
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={120} value={gap.value ?? 0} onChange={(e) => gap.set(Number(e.target.value))} className="flex-1 accent-brand-600" />
          <div className="w-20"><NumberInput value={gap.value} onChange={gap.set} min={0} max={400} suffix="px" placeholder="0" /></div>
        </div>
      </F>
      <F b={wrap} label="Wrap onto new lines" inline><Toggle checked={!!wrap.value} onChange={wrap.set} /></F>
    </Group>
  );
}

// ─── Style tab ────────────────────────────────────────────────────────────

/** Theme fonts or any single font from the list, each option shown in its own face. */
function FontSelect({ value, onChange, themeVars }: { value: Style["font"]; onChange: (v: Style["font"] | undefined) => void; themeVars?: CSSProperties }) {
  const vars = (themeVars ?? {}) as Record<string, string>;
  const face = value === "heading" ? vars["--sf-heading"] : value === "body" ? vars["--sf-font"] : value;
  return (
    <select className={inputCls} value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as Style["font"])} style={face ? { fontFamily: face } : undefined}>
      <option value="">Inherit</option>
      <option value="heading">Theme heading font</option>
      <option value="body">Theme body font</option>
      {FONT_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.fonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function StyleTab({ api, text = true }: { api: Api; text?: boolean }) {
  const k = useKey(api);
  const color = k("color"), font = k("font"), size = k("fontSize"), weight = k("fontWeight"), lh = k("lineHeight"), ls = k("letterSpacing");
  const ta = k("textAlign"), tt = k("textTransform"), italic = k("italic");
  const bg = k("bg"), bgImage = k("bgImage"), bgSize = k("bgSize"), bgPos = k("bgPosition"), overlay = k("overlay");
  const shadow = k("shadow");
  return (
    <div className="flex flex-col gap-4">
      {text && (
        <Group title="Typography">
          <F b={color} label="Text colour"><ColorInput value={color.value} onChange={color.set} themeVars={api.themeVars} /></F>
          <div className="grid grid-cols-2 gap-2">
            <F b={font} label="Font"><FontSelect value={font.value} onChange={font.set} themeVars={api.themeVars} /></F>
            <F b={weight} label="Weight"><select className={inputCls} value={weight.value ?? ""} onChange={(e) => weight.set((e.target.value || undefined) as Style["fontWeight"])}><option value="">Inherit</option>{["300", "400", "500", "600", "700", "800", "900"].map((w) => <option key={w}>{w}</option>)}</select></F>
            <F b={size} label="Size"><NumberInput value={size.value} onChange={size.set} min={6} max={200} suffix="px" /></F>
            <F b={lh} label="Line height"><NumberInput value={lh.value} onChange={lh.set} min={0.5} max={4} step={0.1} /></F>
            <F b={ls} label="Letter spacing"><NumberInput value={ls.value} onChange={ls.set} min={-5} max={30} step={0.5} suffix="px" /></F>
            <F b={tt} label="Case"><select className={inputCls} value={tt.value ?? ""} onChange={(e) => tt.set((e.target.value || undefined) as Style["textTransform"])}><option value="">Inherit</option><option value="none">Normal</option><option value="uppercase">UPPERCASE</option><option value="lowercase">lowercase</option><option value="capitalize">Capitalize</option></select></F>
          </div>
          <F b={ta} label="Alignment">
            <ButtonGroup value={ta.value} onChange={ta.set} options={[
              { value: "left", label: "Left", icon: <AlignLeft className={ico} /> },
              { value: "center", label: "Center", icon: <AlignCenter className={ico} /> },
              { value: "right", label: "Right", icon: <AlignRight className={ico} /> },
              { value: "justify", label: "Justify", icon: <AlignJustify className={ico} /> },
            ]} />
          </F>
          <F b={italic} label="Italic" inline><Toggle checked={!!italic.value} onChange={italic.set} /></F>
        </Group>
      )}
      <Group title="Background">
        <F b={bg} label="Colour"><ColorInput value={bg.value} onChange={bg.set} themeVars={api.themeVars} /></F>
        <F b={bgImage} label="Image"><ImageField value={bgImage.value ?? ""} onChange={(v) => bgImage.set(v || undefined)} /></F>
        {bgImage.value && (
          <div className="grid grid-cols-2 gap-2">
            <F b={bgSize} label="Size"><select className={inputCls} value={bgSize.value ?? "cover"} onChange={(e) => bgSize.set(e.target.value as Style["bgSize"])}><option value="cover">Cover</option><option value="contain">Contain</option><option value="auto">Original</option></select></F>
            <F b={bgPos} label="Position"><select className={inputCls} value={bgPos.value ?? "center"} onChange={(e) => bgPos.set(e.target.value as Style["bgPosition"])}>{["center", "top", "bottom", "left", "right"].map((p) => <option key={p}>{p}</option>)}</select></F>
            <F b={overlay} label="Darken image"><NumberInput value={overlay.value} onChange={overlay.set} min={0} max={90} suffix="%" placeholder="0" /></F>
          </div>
        )}
      </Group>
      <Group title="Shadow" defaultOpen={false}>
        <F b={shadow} label="Shadow"><select className={inputCls} value={shadow.value ?? ""} onChange={(e) => shadow.set((e.target.value || undefined) as Style["shadow"])}><option value="">None</option><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option><option value="xl">Extra large</option></select></F>
        <p className="text-[11px] text-zinc-500">Border and corner radius: <b>Advanced</b> tab.</p>
      </Group>
    </div>
  );
}

// ─── Advanced tab ─────────────────────────────────────────────────────────

/** Border controls (width, style incl. none, colour, corner radius). */
function BorderGroup({ api, hint }: { api: Api; hint?: string }) {
  const k = useKey(api);
  const bw = k("borderWidth"), bs = k("borderStyle"), bc = k("borderColor"), radius = k("radius");
  return (
    <Group title="Border">
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
      <div className="grid grid-cols-2 gap-2">
        <F b={bw} label="Border size"><NumberInput value={bw.value} onChange={bw.set} min={0} max={50} suffix="px" placeholder="Default" /></F>
        <F b={bs} label="Style">
          <select className={inputCls} value={bs.value ?? ""} onChange={(e) => bs.set((e.target.value || undefined) as Style["borderStyle"])}>
            <option value="">Default</option><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="none">None (remove)</option>
          </select>
        </F>
      </div>
      <F b={radius} label="Corner radius">
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={60} value={radius.value ?? 0} onChange={(e) => radius.set(Number(e.target.value))} className="flex-1 accent-brand-600" />
          <div className="w-20"><NumberInput value={radius.value} onChange={radius.set} min={0} max={999} suffix="px" placeholder="0" /></div>
        </div>
      </F>
      <F b={bc} label="Border colour"><ColorInput value={bc.value} onChange={bc.set} themeVars={api.themeVars} /></F>
    </Group>
  );
}

/** Where the element sits inside its container — labels follow the container's direction. */
function PlacementGroup({ api, parentDir }: { api: Api; parentDir: string }) {
  const k = useKey(api);
  const self = k("alignSelf"), push = k("push");
  const row = parentDir.startsWith("row");
  return (
    <Group title="Placement in its container">
      <p className="text-[11px] text-zinc-500">The container lays out its elements {row ? "in a row (left → right)" : "in a column (top → bottom)"}.</p>
      <F b={self} label={row ? "Vertical position" : "Horizontal position"}>
        <ButtonGroup value={self.value ?? "auto"} onChange={(v) => self.set(v === "auto" ? undefined : v)} options={[
          { value: "auto", label: "Container default" },
          { value: "start", label: row ? "Top" : "Left", icon: <AlignStartHorizontal className={cn(ico, !row && "-rotate-90")} /> },
          { value: "center", label: row ? "Middle" : "Centre", icon: <AlignCenterHorizontal className={cn(ico, !row && "-rotate-90")} /> },
          { value: "end", label: row ? "Bottom" : "Right", icon: <AlignEndHorizontal className={cn(ico, !row && "-rotate-90")} /> },
          { value: "stretch", label: row ? "Full height" : "Full width", icon: <StretchHorizontal className={cn(ico, row && "rotate-90")} /> },
        ]} />
      </F>
      <F b={push} label={row ? "Push left / right" : "Push up / down"}>
        <ButtonGroup value={push.value ?? "none"} onChange={(v) => push.set(v === "none" ? undefined : (v as Style["push"]))} options={[
          { value: "start", label: row ? "Push to the left (others move right)" : "Push to the top", icon: row ? <ArrowLeft className={ico} /> : <ArrowUp className={ico} /> },
          { value: "none", label: "In order" },
          { value: "end", label: row ? "Push to the right" : "Push to the bottom", icon: row ? <ArrowRight className={ico} /> : <ArrowDown className={ico} /> },
        ]} />
        {!row && <p className="mt-1 text-[11px] text-zinc-500">Pushing up/down needs a container taller than its content (set its min height).</p>}
      </F>
    </Group>
  );
}

export function AdvancedTab({ api, flexChild = true, parentDir = "column", fieldHint }: { api: Api; flexChild?: boolean; parentDir?: string; fieldHint?: string }) {
  const k = useKey(api);
  const margin = k("margin"), padding = k("padding"), width = k("width"), maxW = k("maxWidth"), minH = k("minHeight"), height = k("height");
  const pos = k("position"), top = k("top"), right = k("right"), bottom = k("bottom"), left = k("left"), z = k("zIndex");
  const grow = k("grow"), order = k("order"), opacity = k("opacity"), overflow = k("overflow");
  const positioned = pos.value && pos.value !== "static";
  return (
    <div className="flex flex-col gap-4">
      {flexChild && <PlacementGroup api={api} parentDir={parentDir} />}
      <Group title="Spacing">
        <F b={margin} label="Margin (outside)"><BoxInput value={margin.value as Box | undefined} onChange={margin.set} allowNegative /></F>
        <F b={padding} label="Padding (inside)"><BoxInput value={padding.value as Box | undefined} onChange={padding.set} /></F>
      </Group>
      <BorderGroup api={api} hint={fieldHint} />
      <Group title="Size">
        <div className="grid grid-cols-2 gap-2">
          <F b={width} label="Width"><LengthInput value={width.value as Length | undefined} onChange={(v) => width.set(v as Style["width"])} min={0} /></F>
          <F b={maxW} label="Max width"><LengthInput value={maxW.value as Length | undefined} onChange={(v) => maxW.set(v as Style["maxWidth"])} min={0} /></F>
          <F b={minH} label="Min height"><LengthInput value={minH.value as Length | undefined} onChange={(v) => minH.set(v as Style["minHeight"])} min={0} /></F>
          <F b={height} label="Height"><LengthInput value={height.value as Length | undefined} onChange={(v) => height.set(v as Style["height"])} min={0} /></F>
        </div>
      </Group>
      <Group title="Position">
        <F b={pos} label="Position">
          <select className={inputCls} value={pos.value ?? "static"} onChange={(e) => pos.set(e.target.value === "static" ? undefined : (e.target.value as Style["position"]))}>
            <option value="static">Default (in the flow)</option>
            <option value="relative">Relative (nudge from its place)</option>
            <option value="absolute">Absolute (free placement in parent)</option>
            <option value="sticky">Sticky (stays on screen while scrolling)</option>
          </select>
        </F>
        {positioned && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <F b={top} label="Top"><LengthInput value={top.value as Length | undefined} onChange={(v) => top.set(v as Style["top"])} /></F>
              <F b={right} label="Right"><LengthInput value={right.value as Length | undefined} onChange={(v) => right.set(v as Style["right"])} /></F>
              <F b={bottom} label="Bottom"><LengthInput value={bottom.value as Length | undefined} onChange={(v) => bottom.set(v as Style["bottom"])} /></F>
              <F b={left} label="Left"><LengthInput value={left.value as Length | undefined} onChange={(v) => left.set(v as Style["left"])} /></F>
            </div>
            {pos.value === "absolute" && <p className="text-[11px] text-zinc-500">Tip: drag the element on the canvas to place it.</p>}
          </>
        )}
        <F b={z} label="Stacking order (z-index)"><NumberInput value={z.value} onChange={z.set} min={-10} max={999} placeholder="Auto" /></F>
      </Group>
      {flexChild && (
        <Group title="Inside its container" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <F b={grow} label="Grow (share of space)"><NumberInput value={grow.value} onChange={grow.set} min={0} max={12} placeholder="0" /></F>
            <F b={order} label="Order"><NumberInput value={order.value} onChange={order.set} min={-20} max={20} placeholder="0" /></F>
          </div>
        </Group>
      )}
      <Group title="Effects" defaultOpen={false}>
        <F b={opacity} label="Opacity">
          <div className="flex items-center gap-2"><input type="range" min={0} max={100} value={opacity.value ?? 100} onChange={(e) => opacity.set(Number(e.target.value))} className="flex-1 accent-brand-600" /><span className="w-8 text-right text-xs text-zinc-500">{opacity.value ?? 100}%</span></div>
        </F>
        <F b={overflow} label="Clip overflowing content" inline><Toggle checked={overflow.value === "hidden"} onChange={(v) => overflow.set(v ? "hidden" : undefined)} /></F>
      </Group>
      <Group title="Responsive">
        <p className="text-[11px] text-zinc-500">Hide on specific devices. Hidden elements are dimmed in the editor.</p>
        {DEVICES.map((d) => {
          const Icon = DEVICE_ICON[d];
          const hidden = !!effectiveStyle(api.rs, d).hidden;
          return (
            <label key={d} className="flex items-center justify-between text-sm text-zinc-700">
              <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-zinc-500" /> Hide on {d}</span>
              <Toggle checked={hidden} onChange={(v) => api.set("hidden", v ? true : d === "desktop" ? undefined : false, d)} />
            </label>
          );
        })}
      </Group>
    </div>
  );
}

// ─── Node content ─────────────────────────────────────────────────────────

const ELEMENT_LABEL: Record<string, string> = {
  container: "Container", heading: "Heading", text: "Text", image: "Image", button: "Button", spacer: "Spacer", divider: "Divider", icon: "Icon", video: "Video",
  search: "Search", form: "Form", input: "Input", textarea: "Text area", select: "Dropdown", checkbox: "Checkbox",
  logo: "Logo", menu: "Menu", cart: "Cart",
  products: "Product grid", "product-image": "Product image", "product-name": "Product name", "product-price": "Price", "product-button": "Add to cart",
};
export const elementLabel = (t: string) => ELEMENT_LABEL[t] ?? t;

type PropSetter = (key: string, value: string | number | boolean) => void;
const lbl = "mb-1 block text-xs font-medium text-zinc-600";

function parseVideoId(raw: string): { provider?: string; id: string } {
  const v = raw.trim();
  const yt = /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,20})/.exec(v);
  if (yt) return { provider: "youtube", id: yt[1] };
  const vm = /vimeo\.com\/(?:video\/)?(\d{5,12})/.exec(v);
  if (vm) return { provider: "vimeo", id: vm[1] };
  return { id: v };
}

const TEXT_TYPES = new Set(["heading", "text", "button", "logo", "menu", "product-name", "product-price", "product-button"]);

/** Font and alignment right in the Content tab for text elements (same values as the Style tab). */
function QuickText({ api }: { api: Api }) {
  const k = useKey(api);
  const font = k("font"), ta = k("textAlign"), size = k("fontSize");
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-3">
      <F b={font} label="Font"><FontSelect value={font.value} onChange={font.set} themeVars={api.themeVars} /></F>
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <F b={ta} label="Text alignment">
          <ButtonGroup value={ta.value} onChange={ta.set} options={[
            { value: "left", label: "Left", icon: <AlignLeft className={ico} /> },
            { value: "center", label: "Center", icon: <AlignCenter className={ico} /> },
            { value: "right", label: "Right", icon: <AlignRight className={ico} /> },
          ]} />
        </F>
        <F b={size} label="Size"><NumberInput value={size.value} onChange={size.set} min={6} max={200} suffix="px" /></F>
      </div>
    </div>
  );
}

const RATIO_OPTIONS = [{ value: "square", label: "Square" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Wide" }, { value: "auto", label: "Original" }];

function NodeContentFields({ node, set, links, api, categories }: { node: LayoutNode; set: PropSetter; links: LinkOption[]; api: Api; categories: { slug: string; name: string }[] }) {
  const p = (k: string) => (node.props[k] === undefined ? "" : String(node.props[k]));
  const toggle = (key: string, label: string) => <label className="flex items-center justify-between text-sm text-zinc-700">{label}<Toggle checked={node.props[key] !== false} onChange={(v) => set(key, v)} /></label>;
  switch (node.type) {
    case "products":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <span className={lbl}>Products to show</span>
            <select className={inputCls} value={p("source") || "latest"} onChange={(e) => set("source", e.target.value)}>
              <option value="latest">Newest products</option><option value="featured">Featured products</option><option value="category">From a category</option>
            </select>
          </div>
          {p("source") === "category" && (
            <div><span className={lbl}>Category</span><select className={inputCls} value={p("category")} onChange={(e) => set("category", e.target.value)}><option value="">Choose…</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><span className={lbl}>Number of products</span><NumberInput value={Number(node.props.limit) || 8} onChange={(v) => set("limit", v ?? 8)} min={1} max={24} /></div>
            <div><span className={lbl}>Sort by</span><select className={inputCls} value={p("sort") || "newest"} onChange={(e) => set("sort", e.target.value)}><option value="newest">Newest</option><option value="price-asc">Price ↑</option><option value="price-desc">Price ↓</option><option value="name">Name</option></select></div>
          </div>
          <div>
            <span className={lbl}>Columns</span>
            <div className="grid grid-cols-3 gap-2">
              {([["columns", "Desktop", 4, 8], ["columnsTablet", "Tablet", 3, 8], ["columnsMobile", "Phone", 2, 4]] as const).map(([key, label, d, max]) => (
                <label key={key} className="text-[11px] text-zinc-500">{label}<NumberInput value={Number(node.props[key]) || d} onChange={(v) => set(key, v ?? d)} min={1} max={max} /></label>
              ))}
            </div>
          </div>
          <p className="rounded-md bg-zinc-50 px-2.5 py-2 text-[11px] text-zinc-600">The <b>first card</b> is the design for every product. Click inside it to style the image, name, price or button, or drop in any element: text, icons, badges, an input named <code>quantity</code> for the add-to-cart button… Space between cards: <b>Gap</b> below.</p>
          <LayoutGroup api={api} />
        </div>
      );
    case "product-image":
      return (
        <div className="flex flex-col gap-3">
          <div><span className={lbl}>Shape</span><ButtonGroup value={p("ratio") || "square"} onChange={(v) => set("ratio", v)} options={RATIO_OPTIONS} /></div>
          {toggle("link", "Opens the product page")}
          {toggle("badges", "Show Sale / Sold out badge")}
          {toggle("zoom", "Zoom on hover")}
          <p className="text-[11px] text-zinc-500">Shows each product&apos;s main photo. Corners and border: Advanced tab.</p>
        </div>
      );
    case "product-name":
      return <div className="flex flex-col gap-3">{toggle("link", "Opens the product page")}<p className="text-[11px] text-zinc-500">Shows each product&apos;s name.</p></div>;
    case "product-price":
      return <div className="flex flex-col gap-3">{toggle("compare", "Show the old price when on sale")}</div>;
    case "product-button":
      return (
        <div className="flex flex-col gap-3">
          <div><span className={lbl}>Text</span><input className={inputCls} value={p("text")} onChange={(e) => set("text", e.target.value)} /></div>
          <div><span className={lbl}>When clicked</span><ButtonGroup value={p("action") === "view" ? "view" : "add"} onChange={(v) => set("action", v)} options={[{ value: "add", label: "Add to cart" }, { value: "view", label: "Open product" }]} /></div>
          <div><span className={lbl}>Style</span><ButtonGroup value={p("variant") || "solid"} onChange={(v) => set("variant", v)} options={[{ value: "solid", label: "Primary" }, { value: "secondary", label: "Second." }, { value: "outline", label: "Outline" }, { value: "dark", label: "Dark" }, { value: "link", label: "Link" }]} /></div>
          <div><span className={lbl}>Size</span><ButtonGroup value={p("size") || "md"} onChange={(v) => set("size", v)} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} /></div>
          <div><span className={lbl}>Width</span><ButtonGroup value={p("align") || "left"} onChange={(v) => set("align", v)} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }, { value: "full", label: "Full" }]} /></div>
          <p className="text-[11px] text-zinc-500">Products with options (size, colour…) show “Choose options” and open their page. If the card has an input named <code>quantity</code>, that many are added.</p>
        </div>
      );
    case "container":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <span className={lbl}>Content width</span>
            <ButtonGroup value={p("contentWidth") === "boxed" ? "boxed" : "full"} onChange={(v) => set("contentWidth", v)} options={[{ value: "boxed", label: "Boxed (centred)" }, { value: "full", label: "Full width" }]} />
          </div>
          <LayoutGroup api={api} />
        </div>
      );
    case "heading":
      return (
        <div className="flex flex-col gap-3">
          <div><span className={lbl}>Text</span><textarea rows={2} className={inputCls} value={p("text")} onChange={(e) => set("text", e.target.value)} /></div>
          <div><span className={lbl}>HTML tag</span><ButtonGroup value={p("tag") || "h2"} onChange={(v) => set("tag", v)} options={["h1", "h2", "h3", "h4", "h5", "h6", "p"].map((t) => ({ value: t, label: t.toUpperCase() }))} /></div>
          <div><span className={lbl}>Link (optional)</span><LinkField value={p("link")} onChange={(v) => set("link", v)} links={links} /></div>
        </div>
      );
    case "text":
      return <div><span className={lbl}>Text</span><textarea rows={6} className={inputCls} value={p("text")} onChange={(e) => set("text", e.target.value)} /></div>;
    case "image":
      return (
        <div className="flex flex-col gap-3">
          <ImageField value={p("src")} onChange={(v) => set("src", v)} />
          <div><span className={lbl}>Alt text (for accessibility & SEO)</span><input className={inputCls} value={p("alt")} onChange={(e) => set("alt", e.target.value)} /></div>
          <div><span className={lbl}>Fit</span><ButtonGroup value={p("fit") || "cover"} onChange={(v) => set("fit", v)} options={[{ value: "cover", label: "Fill & crop" }, { value: "contain", label: "Fit inside" }, { value: "fill", label: "Stretch" }]} /></div>
          <div><span className={lbl}>Link (optional)</span><LinkField value={p("link")} onChange={(v) => set("link", v)} links={links} /></div>
        </div>
      );
    case "button":
      return (
        <div className="flex flex-col gap-3">
          <div><span className={lbl}>Text</span><input className={inputCls} value={p("text")} onChange={(e) => set("text", e.target.value)} /></div>
          <div>
            <span className={lbl}>When clicked</span>
            <ButtonGroup value={p("action") === "submit" ? "submit" : "link"} onChange={(v) => set("action", v)} options={[{ value: "link", label: "Open a link" }, { value: "submit", label: "Submit form" }]} />
            <p className="mt-1 text-[11px] text-zinc-500">{p("action") === "submit" ? "Place this button inside a Form element." : "Add a workflow (⚡) for more actions — it replaces the link."}</p>
          </div>
          {p("action") !== "submit" && <div><span className={lbl}>Link</span><LinkField value={p("link")} onChange={(v) => set("link", v)} links={links} /></div>}
          <div><span className={lbl}>Style</span><ButtonGroup value={p("variant") || "solid"} onChange={(v) => set("variant", v)} options={[{ value: "solid", label: "Primary" }, { value: "secondary", label: "Second." }, { value: "outline", label: "Outline" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "link", label: "Link" }]} /></div>
          <div><span className={lbl}>Size</span><ButtonGroup value={p("size") || "md"} onChange={(v) => set("size", v)} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} /></div>
          <div><span className={lbl}>Alignment</span><ButtonGroup value={p("align") || "left"} onChange={(v) => set("align", v)} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }, { value: "full", label: "Full" }]} /></div>
        </div>
      );
    case "logo":
      return (
        <div className="flex flex-col gap-3">
          <div><span className={lbl}>Logo image (optional)</span><ImageField value={p("image")} onChange={(v) => set("image", v)} /></div>
          <div><span className={lbl}>Text (when there&apos;s no image — empty uses your store name)</span><input className={inputCls} value={p("text")} onChange={(e) => set("text", e.target.value)} /></div>
          {p("image") && <div><span className={lbl}>Image height</span><NumberInput value={Number(node.props.height) || 36} onChange={(v) => set("height", v ?? 36)} min={16} max={160} suffix="px" /></div>}
          <p className="text-[11px] text-zinc-500">Links to your home page.</p>
        </div>
      );
    case "menu":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <span className={lbl}>Links — one per line: Label | /address</span>
            <textarea rows={6} className={cn(inputCls, "font-mono")} value={p("links")} onChange={(e) => set("links", e.target.value)} placeholder={"Shop | /products\nAbout | /about"} />
            <p className="mt-1 text-[11px] text-zinc-500">Addresses: {links.slice(0, 4).map((l) => l.value).join(", ")}…</p>
          </div>
          <div><span className={lbl}>On phones</span><ButtonGroup value={p("mobile") || "hamburger"} onChange={(v) => set("mobile", v)} options={[{ value: "hamburger", label: "Menu button" }, { value: "inline", label: "Show links" }, { value: "hidden", label: "Hide" }]} /></div>
          <p className="text-[11px] text-zinc-500">Space between links: <b>Gap</b> in the Layout group below. Text size and colour: Style tab.</p>
          <LayoutGroup api={api} />
        </div>
      );
    case "cart":
      return (
        <div className="flex flex-col gap-3">
          <div><span className={lbl}>Icon size</span><NumberInput value={Number(node.props.size) || 22} onChange={(v) => set("size", v ?? 22)} min={12} max={64} suffix="px" /></div>
          <label className="flex items-center justify-between text-sm text-zinc-700">Show item count<Toggle checked={node.props.showCount !== false} onChange={(v) => set("showCount", v)} /></label>
          <p className="text-[11px] text-zinc-500">Opens the cart. The count updates as shoppers add products.</p>
        </div>
      );
    case "search":
      return (
        <div className="flex flex-col gap-3">
          <div><span className={lbl}>Show as</span><ButtonGroup value={p("variant") === "icon" ? "icon" : "box"} onChange={(v) => set("variant", v)} options={[{ value: "box", label: "Search box" }, { value: "icon", label: "Icon (opens a box)" }]} /></div>
          <div><span className={lbl}>Placeholder</span><input className={inputCls} value={p("placeholder")} onChange={(e) => set("placeholder", e.target.value)} /></div>
          <div><span className={lbl}>Button text (empty = no button)</span><input className={inputCls} value={p("buttonText")} onChange={(e) => set("buttonText", e.target.value)} /></div>
          <p className="text-[11px] text-zinc-500">Searches your products and opens the Shop page with the results.</p>
        </div>
      );
    case "form":
      return (
        <div className="flex flex-col gap-4">
          <div><span className={lbl}>Form name (shown in your dashboard inbox)</span><input className={inputCls} value={p("formName")} maxLength={80} onChange={(e) => set("formName", e.target.value)} /></div>
          <div><span className={lbl}>Message after sending</span><textarea rows={2} className={inputCls} value={p("successMessage")} onChange={(e) => set("successMessage", e.target.value)} /></div>
          <p className="text-[11px] text-zinc-500">Drop Input, Text area, Dropdown and Checkbox elements inside, plus a button set to <b>Submit form</b>. Submissions appear in <b>Dashboard → Form submissions</b>. Add a workflow (⚡) to do more on submit.</p>
          <LayoutGroup api={api} />
        </div>
      );
    case "input":
    case "textarea":
    case "select":
    case "checkbox":
      return (
        <div className="flex flex-col gap-3">
          <div><span className={lbl}>Label</span><input className={inputCls} value={p("label")} onChange={(e) => set("label", e.target.value)} /></div>
          <div>
            <span className={lbl}>Field name (used in submissions & workflows)</span>
            <input className={cn(inputCls, "font-mono")} value={p("name")} onChange={(e) => set("name", e.target.value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40))} />
          </div>
          {node.type === "input" && <div><span className={lbl}>Type</span><select className={inputCls} value={p("inputType") || "text"} onChange={(e) => set("inputType", e.target.value)}>{[["text", "Text"], ["email", "Email"], ["tel", "Phone"], ["number", "Number"], ["date", "Date"], ["url", "Website"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>}
          {(node.type === "input" || node.type === "textarea") && <div><span className={lbl}>Placeholder</span><input className={inputCls} value={p("placeholder")} onChange={(e) => set("placeholder", e.target.value)} /></div>}
          {node.type === "textarea" && <div><span className={lbl}>Rows</span><NumberInput value={Number(node.props.rows) || 4} onChange={(v) => set("rows", v ?? 4)} min={2} max={20} /></div>}
          {node.type === "select" && <div><span className={lbl}>Options (one per line)</span><textarea rows={5} className={inputCls} value={p("options")} onChange={(e) => set("options", e.target.value)} /></div>}
          <label className="flex items-center justify-between text-sm text-zinc-700">Required<Toggle checked={node.props.required === true} onChange={(v) => set("required", v)} /></label>
        </div>
      );
    case "divider":
      return <div><span className={lbl}>Thickness</span><NumberInput value={Number(node.props.thickness) || 1} onChange={(v) => set("thickness", v ?? 1)} min={1} max={20} suffix="px" /></div>;
    case "icon":
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-6 gap-1">
            {Object.entries(NODE_ICONS).map(([key, Icon]) => (
              <button key={key} type="button" title={key} onClick={() => set("icon", key)} className={cn("flex aspect-square items-center justify-center rounded border", p("icon") === key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-zinc-200 text-zinc-600 hover:border-zinc-400")}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <div><span className={lbl}>Size</span><NumberInput value={Number(node.props.size) || 32} onChange={(v) => set("size", v ?? 32)} min={8} max={200} suffix="px" /></div>
        </div>
      );
    case "video":
      return (
        <div className="flex flex-col gap-3">
          <div><span className={lbl}>Provider</span><ButtonGroup value={p("provider") || "youtube"} onChange={(v) => set("provider", v)} options={[{ value: "youtube", label: "YouTube" }, { value: "vimeo", label: "Vimeo" }]} /></div>
          <div>
            <span className={lbl}>Video link or ID</span>
            <input className={inputCls} value={p("videoId")} placeholder="https://youtu.be/…" onChange={(e) => { const r = parseVideoId(e.target.value); if (r.provider) set("provider", r.provider); set("videoId", r.id); }} />
          </div>
        </div>
      );
    case "spacer":
      return <p className="text-xs text-zinc-500">Set the spacer&apos;s height in the <b>Advanced</b> tab, or drag its bottom edge on the canvas.</p>;
  }
}

type Tab = "content" | "style" | "advanced";

const TW_EXAMPLES = ["rounded-2xl", "shadow-xl", "hover:scale-105", "transition", "bg-primary", "text-store-text", "@3xl:flex-row", "ring-2"];

/** Custom Tailwind classes (Advanced tab) for an element or a section. */
export function TailwindField({ value, onChange, inner }: { value: string; onChange: (v: string) => void; inner?: string }) {
  const bad = invalidTwTokens(value);
  const add = (c: string) => onChange([...value.trim().split(/\s+/).filter(Boolean), c].join(" "));
  return (
    <div className="mt-4 rounded-lg border border-zinc-200 p-3">
      <p className="text-xs font-semibold text-zinc-800">Custom Tailwind classes</p>
      <textarea
        rows={3}
        spellCheck={false}
        className={cn(inputCls, "mt-2 font-mono text-xs", bad.length > 0 && "border-red-400")}
        value={value}
        maxLength={MAX_TW_LENGTH}
        placeholder="e.g. rounded-2xl shadow-lg hover:-translate-y-1 transition"
        onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      />
      {bad.length > 0 && <p className="mt-1 text-[11px] text-red-600">Not allowed (ignored): {bad.slice(0, 4).join(" ")}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {TW_EXAMPLES.filter((c) => !value.split(/\s+/).includes(c)).slice(0, 6).map((c) => (
          <button key={c} type="button" onClick={() => add(c)} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 hover:bg-brand-50 hover:text-brand-700">+ {c}</button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Any Tailwind class{inner ? <> — applied to the {inner}</> : null}. They override the settings above. Store colours: <code>primary</code>, <code>secondary</code>, <code>store-bg</code>, <code>store-text</code>; fonts: <code>font-heading</code>, <code>font-body</code>. For screen sizes use container variants: <code>@3xl:</code> (tablet and up), <code>@5xl:</code> (desktop); <code>hover:</code> and <code>focus:</code> work too.
      </p>
    </div>
  );
}

export type ArrangeAction = "first" | "earlier" | "later" | "last" | "wrapRow" | "wrapColumn" | "ungroup";

export function NodeProperties({ node, trail, sectionLabel, device, style, setProp, setStyle, themeVars, links, categories = [], onSelect, onSelectSection, onDuplicate, onDelete, onSaveBlock, onLogic, onArrange, parentDir, onCopy, onPaste, canPaste, setTw }: {
  node: LayoutNode;
  trail: LayoutNode[];
  sectionLabel: string;
  device: Device;
  style: ResponsiveStyle | undefined;
  setProp: PropSetter;
  setStyle: StyleSetter;
  themeVars: CSSProperties;
  links: LinkOption[];
  categories?: { slug: string; name: string }[];
  onCopy: () => void;
  onPaste: () => void;
  setTw: (v: string) => void;
  canPaste: boolean;
  onSelect: (id: string) => void;
  onSelectSection: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveBlock: () => void;
  onLogic: () => void;
  onArrange: (a: ArrangeAction) => void;
  /** Direction of the container holding this element on the current device. */
  parentDir: string;
}) {
  const [tab, setTab] = useState<Tab>("content");
  const row = parentDir.startsWith("row");
  const ab = "flex flex-1 items-center justify-center rounded px-1 py-1 text-zinc-600 hover:bg-zinc-100";
  const api: Api = { rs: style, device, set: setStyle, themeVars };
  const DeviceIcon = DEVICE_ICON[device];
  return (
    <div className="flex flex-col">
      <nav className="mb-2 flex flex-wrap items-center gap-0.5 text-[11px] text-zinc-500" aria-label="Element path">
        <button onClick={onSelectSection} className="hover:text-zinc-900">{sectionLabel}</button>
        {trail.map((t) => (
          <span key={t.id} className="flex items-center gap-0.5"><ChevronRight className="h-3 w-3" /><button onClick={() => onSelect(t.id)} className="hover:text-zinc-900">{elementLabel(t.type)}</button></span>
        ))}
        <ChevronRight className="h-3 w-3" /><span className="font-semibold text-zinc-900">{elementLabel(node.type)}</span>
      </nav>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-zinc-900">{elementLabel(node.type)}</p>
        <div className="flex items-center gap-0.5 text-zinc-500">
          {trail.length > 0 && <button onClick={() => onSelect(trail[trail.length - 1].id)} className="rounded p-1.5 hover:bg-zinc-100" title="Select parent (Alt+click)"><CornerLeftUp className="h-3.5 w-3.5" /></button>}
          <button onClick={onSaveBlock} className="rounded p-1.5 hover:bg-zinc-100" title="Save as reusable block"><Bookmark className="h-3.5 w-3.5" /></button>
          <button onClick={onCopy} className="rounded p-1.5 hover:bg-zinc-100" title="Copy (⌘C) — then select where it goes and paste"><ClipboardCopy className="h-3.5 w-3.5" /></button>
          <button onClick={onPaste} disabled={!canPaste} className="rounded p-1.5 hover:bg-zinc-100 disabled:opacity-30" title={PARENT_TYPES.has(node.type) ? "Paste inside (⌘V)" : "Paste after (⌘V)"}><ClipboardPaste className="h-3.5 w-3.5" /></button>
          <button onClick={onDuplicate} className="rounded p-1.5 hover:bg-zinc-100" title="Duplicate (⌘D)"><Copy className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete (Del)"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {device !== "desktop" && (
        <p className="mb-3 flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1.5 text-[11px] text-brand-800">
          <DeviceIcon className="h-3.5 w-3.5" /> Style changes apply to <b>{device}</b> only.
        </p>
      )}
      <button onClick={onLogic} className="mb-3 flex items-center justify-center gap-2 rounded-md border border-orange-200 bg-orange-50 py-2 text-xs font-semibold text-orange-800 hover:border-orange-400">
        <Zap className="h-3.5 w-3.5" /> Conditions & workflows{node.conditions?.length ? ` (${node.conditions.length})` : ""}
      </button>
      <div className="mb-3 flex items-center gap-0.5 rounded-md border border-zinc-200 p-0.5" role="toolbar" aria-label="Arrange">
        <button className={ab} onClick={() => onArrange("first")} title={row ? "Move to the start (far left)" : "Move to the top"}><ChevronsLeft className={cn(ico, !row && "rotate-90")} /></button>
        <button className={ab} onClick={() => onArrange("earlier")} title={row ? "Move left" : "Move up"}><ChevronLeft className={cn(ico, !row && "rotate-90")} /></button>
        <button className={ab} onClick={() => onArrange("later")} title={row ? "Move right" : "Move down"}><ChevronRight className={cn(ico, !row && "rotate-90")} /></button>
        <button className={ab} onClick={() => onArrange("last")} title={row ? "Move to the end (far right)" : "Move to the bottom"}><ChevronsRight className={cn(ico, !row && "rotate-90")} /></button>
        <span className="mx-0.5 h-5 w-px bg-zinc-200" />
        <button className={ab} onClick={() => onArrange("wrapRow")} title="Group in a row (⌘G)"><Columns2 className={ico} /></button>
        <button className={ab} onClick={() => onArrange("wrapColumn")} title="Group in a column (⌘⇧G)"><Rows2 className={ico} /></button>
        {node.type === "container" && <button className={ab} onClick={() => onArrange("ungroup")} title="Ungroup (keep the elements, remove this container)"><Ungroup className={ico} /></button>}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "content", label: "Content" }, { value: "style", label: "Style" }, { value: "advanced", label: "Advanced" }]} />
      {tab === "content" && <NodeContentFields node={node} set={setProp} links={links} api={api} categories={categories} />}
      {tab === "content" && TEXT_TYPES.has(node.type) && <QuickText api={api} />}
      {tab === "style" && <StyleTab api={api} text={!["spacer", "divider", "image", "video"].includes(node.type)} />}
      {tab === "advanced" && <><AdvancedTab api={api} parentDir={parentDir} fieldHint={["input", "textarea", "select", "search"].includes(node.type) ? "Styles the field box itself — set the style to None to remove its border." : undefined} /><TailwindField value={node.tw ?? ""} onChange={setTw} inner={["button", "product-button"].includes(node.type) ? "button itself" : ["input", "textarea", "select"].includes(node.type) ? "field itself" : undefined} /></>}
    </div>
  );
}

/** Several elements selected (shift-click): group them. */
export function MultiProperties({ count, sameParent, onGroup, onDelete, onClear }: { count: number; sameParent: boolean; onGroup: (d: "row" | "column") => void; onDelete: () => void; onClear: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-zinc-900">{count} elements selected</p>
      <p className="text-xs text-zinc-500">Shift-click elements on the canvas to add or remove them.</p>
      {sameParent ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onGroup("row")} className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 p-3 text-sm hover:border-brand-500"><Columns2 className="h-5 w-5" />Group in a row<span className="text-[10px] text-zinc-400">⌘G</span></button>
          <button onClick={() => onGroup("column")} className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 p-3 text-sm hover:border-brand-500"><Rows2 className="h-5 w-5" />Group in a column<span className="text-[10px] text-zinc-400">⌘⇧G</span></button>
        </div>
      ) : (
        <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900">To group, pick elements that sit in the same container.</p>
      )}
      <button onClick={onDelete} className="flex items-center justify-center gap-2 rounded-md border border-red-200 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete {count} elements</button>
      <button onClick={onClear} className="text-xs text-zinc-500 underline">Clear selection</button>
    </div>
  );
}

/** Existing sections: their settings (Content) plus the new Style / Advanced tabs. */
export function SectionTabs({ section, device, setStyle, themeVars, onChange, categories, links, onSaveBlock, onCustomise, onCopy, setTw }: {
  section: Section;
  device: Device;
  setStyle: StyleSetter;
  themeVars: CSSProperties;
  onChange: Parameters<typeof SectionProperties>[0]["onChange"];
  categories: { slug: string; name: string }[];
  links: LinkOption[];
  onSaveBlock?: () => void;
  /** Product grid: switch to a fully editable layout. */
  onCustomise?: () => void;
  onCopy?: () => void;
  setTw: (v: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("content");
  const api: Api = { rs: section.style, device, set: setStyle, themeVars };
  const custom = section.type === "custom";
  return (
    <div className="flex flex-col">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "content", label: custom ? "Layout" : "Content" }, { value: "style", label: "Style" }, { value: "advanced", label: "Advanced" }]} />
      {tab === "content" && (custom ? (
        <div className="flex flex-col gap-4">
          <div><p className="font-semibold text-zinc-900">Custom layout</p><p className="text-xs text-zinc-500">Drag containers and elements from the left panel into this section. Click any element to style it.</p></div>
          <LayoutGroup api={api} />
        </div>
      ) : (
        <>
          {onCustomise && (
            <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
              <p className="text-sm font-semibold text-brand-900">Design the cards yourself</p>
              <p className="mt-0.5 text-xs text-brand-800">Turns this grid into a custom layout: style the image, name, price and button, centre the text, and add any element to the cards (text, icons, an input…).</p>
              <button type="button" onClick={onCustomise} className="mt-2 w-full rounded-md bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Customise the cards</button>
            </div>
          )}
          <SectionProperties section={section} onChange={onChange} categories={categories} links={links} />
        </>
      ))}
      {tab === "style" && <StyleTab api={api} />}
      {tab === "advanced" && <><AdvancedTab api={api} flexChild={false} /><TailwindField value={section.tw ?? ""} onChange={setTw} /></>}
      {onSaveBlock && (
        <button type="button" onClick={onSaveBlock} className="mt-5 flex items-center justify-center gap-2 rounded-md border border-zinc-300 py-2 text-xs font-medium text-zinc-700 hover:border-brand-500">
          <Bookmark className="h-3.5 w-3.5" /> Save section as reusable block
        </button>
      )}
      {onCopy && (
        <button type="button" onClick={onCopy} className="mt-2 flex items-center justify-center gap-2 rounded-md border border-zinc-300 py-2 text-xs font-medium text-zinc-700 hover:border-brand-500">
          <ClipboardCopy className="h-3.5 w-3.5" /> Copy section (⌘C) — paste with ⌘V
        </button>
      )}
    </div>
  );
}
