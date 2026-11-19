/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import type { ListItem, Section, SettingValue, SiteConfig, SitePage, Theme } from "@/lib/editor/schema";
import { SECTION_MAP, setting, type FieldDef } from "@/lib/editor/sections";
import { FONTS } from "@/lib/editor/fonts";
import { uploadImage } from "@/components/dashboard/image-uploader";
import { cn } from "@/components/ui";
import { slugify } from "@/lib/slug";

const input = "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
const labelCls = "mb-1 block text-xs font-medium text-zinc-600";

export type LinkOption = { value: string; label: string };

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="group relative overflow-hidden rounded-md border border-zinc-200">
          <img src={value} alt="" className="h-28 w-full object-cover" />
          <button type="button" onClick={() => onChange("")} className="absolute right-1 top-1 rounded-full bg-white p-1 shadow" aria-label="Remove image"><X className="h-3 w-3" /></button>
        </div>
      ) : null}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 py-2 text-xs text-zinc-600 hover:border-brand-500">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {value ? "Replace image" : "Upload image"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true); setError(null);
          try { onChange(await uploadImage(f)); } catch (err) { setError((err as Error).message); }
          setBusy(false);
          e.target.value = "";
        }} />
      </label>
      <input className={input} placeholder="…or paste an https:// image URL" value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-0.5" />
      <input className={cn(input, "font-mono")} value={value} placeholder="Theme default" onChange={(e) => onChange(e.target.value)} maxLength={7} />
      {value && <button type="button" onClick={() => onChange("")} className="text-xs text-zinc-500 hover:text-zinc-900">Reset</button>}
    </div>
  );
}

function LinkField({ value, onChange, links }: { value: string; onChange: (v: string) => void; links: LinkOption[] }) {
  const id = `links-${Math.abs(links.length)}`;
  return (
    <>
      <input className={input} list={id} value={value} placeholder="/products or https://…" onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>{links.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</datalist>
    </>
  );
}

function ListField({ field, value, onChange, links }: { field: Extract<FieldDef, { type: "list" }>; value: ListItem[]; onChange: (v: ListItem[]) => void; links: LinkOption[] }) {
  const update = (i: number, k: string, v: string) => onChange(value.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {value.map((item, i) => (
        <div key={i} className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">{field.itemLabel} {i + 1}</span>
            <span className="flex gap-0.5">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-zinc-200 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3 w-3" /></button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-zinc-200 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3 w-3" /></button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label="Remove"><Trash2 className="h-3 w-3" /></button>
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {field.fields.map((f) => {
              const v = String(item[f.key] ?? "");
              if (f.type === "image") return <ImageField key={f.key} value={v} onChange={(x) => update(i, f.key, x)} />;
              if (f.type === "textarea") return <textarea key={f.key} rows={2} className={input} placeholder={f.label} value={v} onChange={(e) => update(i, f.key, e.target.value)} />;
              if (f.type === "link") return <LinkField key={f.key} value={v} onChange={(x) => update(i, f.key, x)} links={links} />;
              return <input key={f.key} className={input} placeholder={f.label} value={v} onChange={(e) => update(i, f.key, e.target.value)} />;
            })}
          </div>
        </div>
      ))}
      {value.length < 50 && (
        <button type="button" onClick={() => onChange([...value, Object.fromEntries(field.fields.map((f) => [f.key, ""]))])} className="flex items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-600 hover:border-brand-500">
          <Plus className="h-3 w-3" /> Add {field.itemLabel.toLowerCase()}
        </button>
      )}
    </div>
  );
}

function FieldControl({ field, value, onChange, categories, links }: { field: FieldDef; value: SettingValue; onChange: (v: SettingValue) => void; categories: { slug: string; name: string }[]; links: LinkOption[] }) {
  const str = typeof value === "string" ? value : value == null ? "" : String(value);
  switch (field.type) {
    case "text": return <input className={input} value={str} onChange={(e) => onChange(e.target.value)} />;
    case "textarea": return <textarea rows={4} className={input} value={str} onChange={(e) => onChange(e.target.value)} />;
    case "link": return <LinkField value={str} onChange={onChange} links={links} />;
    case "color": return <ColorField value={str} onChange={onChange} />;
    case "image": return <ImageField value={str} onChange={onChange} />;
    case "number": return <input type="number" className={input} min={field.min} max={field.max} step={field.step ?? 1} value={str} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "toggle":
      return (
        <button type="button" role="switch" aria-checked={value === true} onClick={() => onChange(!(value === true))} className={cn("relative h-5 w-9 rounded-full transition", value === true ? "bg-brand-600" : "bg-zinc-300")}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", value === true ? "left-[18px]" : "left-0.5")} />
        </button>
      );
    case "select": return <select className={input} value={str} onChange={(e) => onChange(e.target.value)}>{field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    case "category":
      return (
        <select className={input} value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">{categories.length ? "Choose a category" : "No categories yet"}</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      );
    case "list": return <ListField field={field} value={Array.isArray(value) ? value : []} onChange={onChange} links={links} />;
  }
}

export function SectionProperties({ section, onChange, categories, links }: { section: Section; onChange: (key: string, v: SettingValue) => void; categories: { slug: string; name: string }[]; links: LinkOption[] }) {
  const def = SECTION_MAP[section.type];
  if (!def) return null;
  const source = setting(section, "source");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-semibold text-zinc-900">{def.label}</p>
        <p className="text-xs text-zinc-500">{def.global ? "Shown on every page of your store" : def.description}</p>
      </div>
      {def.fields.map((f) => {
        if (f.type === "category" && source !== "category") return null;
        return (
          <div key={f.key} className={f.type === "toggle" ? "flex items-center justify-between gap-3" : ""}>
            <span className={f.type === "toggle" ? "text-sm text-zinc-700" : labelCls}>{f.label}</span>
            <FieldControl field={f} value={setting(section, f.key)} onChange={(v) => onChange(f.key, v)} categories={categories} links={links} />
          </div>
        );
      })}
    </div>
  );
}

export function ThemeProperties({ config, onTheme, onSeo }: { config: SiteConfig; onTheme: (patch: Partial<Theme>) => void; onSeo: (patch: Partial<SiteConfig["seo"]>) => void }) {
  const t = config.theme;
  const colors: [keyof Theme, string][] = [["primaryColor", "Brand colour (buttons, accents)"], ["secondaryColor", "Soft background"], ["backgroundColor", "Page background"], ["textColor", "Text"]];
  return (
    <div className="flex flex-col gap-4">
      <div><p className="font-semibold">Theme</p><p className="text-xs text-zinc-500">Colours and fonts used across your whole store</p></div>
      {colors.map(([k, label]) => (
        <div key={k}><span className={labelCls}>{label}</span><ColorField value={t[k] as string} onChange={(v) => /^#[0-9a-f]{6}$/i.test(v) && onTheme({ [k]: v })} /></div>
      ))}
      <div><span className={labelCls}>Heading font</span><select className={input} value={t.headingFont} onChange={(e) => onTheme({ headingFont: e.target.value })} style={{ fontFamily: t.headingFont }}>{FONTS.map((f) => <option key={f} style={{ fontFamily: f }}>{f}</option>)}</select></div>
      <div><span className={labelCls}>Body font</span><select className={input} value={t.font} onChange={(e) => onTheme({ font: e.target.value })} style={{ fontFamily: t.font }}>{FONTS.map((f) => <option key={f} style={{ fontFamily: f }}>{f}</option>)}</select></div>
      <div>
        <span className={labelCls}>Corner style</span>
        <div className="grid grid-cols-5 gap-1">
          {(["none", "sm", "md", "lg", "full"] as const).map((r) => (
            <button key={r} type="button" onClick={() => onTheme({ radius: r })} className={cn("border px-1 py-1.5 text-[11px]", t.radius === r ? "border-brand-600 bg-brand-50 text-brand-700" : "border-zinc-300")} style={{ borderRadius: { none: 0, sm: 4, md: 8, lg: 14, full: 999 }[r] }}>{r}</button>
          ))}
        </div>
      </div>
      <hr className="border-zinc-200" />
      <div><p className="font-semibold">Search & sharing</p><p className="text-xs text-zinc-500">How your store appears on Google, WhatsApp and social media</p></div>
      <div><span className={labelCls}>Site title</span><input className={input} maxLength={120} value={config.seo.title ?? ""} onChange={(e) => onSeo({ title: e.target.value })} /></div>
      <div><span className={labelCls}>Meta description</span><textarea rows={3} maxLength={300} className={input} value={config.seo.description ?? ""} onChange={(e) => onSeo({ description: e.target.value })} /></div>
      <div><span className={labelCls}>Social sharing image</span><ImageField value={config.seo.image ?? ""} onChange={(v) => onSeo({ image: v })} /></div>
      <label className="flex items-center justify-between gap-3 text-sm text-zinc-700">Hide from search engines<input type="checkbox" checked={!!config.seo.noindex} onChange={(e) => onSeo({ noindex: e.target.checked })} /></label>
    </div>
  );
}

export function PageProperties({ page, onChange, onDelete }: { page: SitePage; onChange: (patch: Partial<SitePage>) => void; onDelete?: () => void }) {
  const isHome = page.slug === "/";
  return (
    <div className="flex flex-col gap-4">
      <div><p className="font-semibold">Page settings</p><p className="text-xs text-zinc-500">{isHome ? "Your homepage" : `Lives at ${page.slug}`}</p></div>
      <div><span className={labelCls}>Page name</span><input className={input} value={page.name} maxLength={60} onChange={(e) => onChange({ name: e.target.value })} /></div>
      {!isHome && <div><span className={labelCls}>Address</span><input className={input} value={page.slug} onChange={(e) => onChange({ slug: "/" + slugify(e.target.value.replace(/^\//, "")) })} /></div>}
      <div><span className={labelCls}>SEO title</span><input className={input} maxLength={120} value={page.seoTitle ?? ""} onChange={(e) => onChange({ seoTitle: e.target.value })} /></div>
      <div><span className={labelCls}>SEO description</span><textarea rows={3} maxLength={300} className={input} value={page.seoDescription ?? ""} onChange={(e) => onChange({ seoDescription: e.target.value })} /></div>
      {onDelete && !isHome && <button type="button" onClick={onDelete} className="flex items-center justify-center gap-2 rounded-md border border-red-200 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete page</button>}
    </div>
  );
}
