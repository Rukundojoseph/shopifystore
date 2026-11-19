"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { ImageUploader } from "./image-uploader";
import { saveProductAction, type ProductInput } from "@/app/dashboard/products/actions";

type Option = { name: string; values: string[] };
type Variant = NonNullable<ProductInput["variants"]>[number];

function cartesian(options: Option[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>((acc, opt) => acc.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name]: v }))), [{}]);
}

const toInt = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s.replace(/[,\s]/g, "")) || 0)));

export function ProductForm({ initial, categories }: { initial?: ProductInput; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [p, setP] = useState<ProductInput>(
    initial ?? {
      name: "", description: "", price: 0, compareAtPrice: null, sku: "", stockQuantity: 0, trackInventory: true,
      status: "ACTIVE", featured: false, categoryId: null, images: [], options: [], variants: [], seoTitle: "", seoDescription: "",
    },
  );
  const [optionDrafts, setOptionDrafts] = useState<{ name: string; values: string }[]>(
    (initial?.options ?? []).map((o) => ({ name: o.name, values: o.values.join(", ") })),
  );
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => { setSaved(false); setP((x) => ({ ...x, [k]: v })); };
  const hasVariants = (p.variants?.length ?? 0) > 0;

  const parsedOptions: Option[] = useMemo(
    () => optionDrafts.map((o) => ({ name: o.name.trim(), values: [...new Set(o.values.split(",").map((v) => v.trim()).filter(Boolean))] })).filter((o) => o.name && o.values.length),
    [optionDrafts],
  );

  function generateVariants() {
    const combos = cartesian(parsedOptions);
    const existing = p.variants ?? [];
    const variants: Variant[] = combos.map((combo) => {
      const prev = existing.find((v) => JSON.stringify(v.optionValues) === JSON.stringify(combo));
      return prev ?? { title: Object.values(combo).join(" / "), optionValues: combo, sku: "", price: null, stockQuantity: 0 };
    });
    setP((x) => ({ ...x, options: parsedOptions, variants }));
  }

  function updateVariant(i: number, patch: Partial<Variant>) {
    setP((x) => ({ ...x, variants: (x.variants ?? []).map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveProductAction({ ...p, options: hasVariants ? parsedOptions : [] });
      if (res.error) return setError(res.error);
      setSaved(true);
      if (!p.id) router.push(`/dashboard/products/${res.id}?created=1`);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        {error && <Alert tone="error">{error}</Alert>}
        <Card className="flex flex-col gap-4 p-5">
          <Field label="Product name"><Input value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Kitenge print shirt" /></Field>
          <Field label="Description"><Textarea rows={6} value={p.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Materials, sizing, care instructions…" /></Field>
        </Card>

        <Card>
          <CardHeader title="Images" />
          <div className="p-5"><ImageUploader value={p.images ?? []} onChange={(v) => set("images", v)} /></div>
        </Card>

        <Card>
          <CardHeader title="Pricing" description="Prices are in Rwandan francs (RWF)" />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Price (RWF)"><Input inputMode="numeric" value={p.price ? String(p.price) : ""} onChange={(e) => set("price", toInt(e.target.value) ?? 0)} placeholder="0" /></Field>
            <Field label="Compare-at price" hint="Original price, shown crossed out"><Input inputMode="numeric" value={p.compareAtPrice ? String(p.compareAtPrice) : ""} onChange={(e) => set("compareAtPrice", toInt(e.target.value))} placeholder="Optional" /></Field>
            <Field label="SKU"><Input value={p.sku ?? ""} onChange={(e) => set("sku", e.target.value)} placeholder="Optional" /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Variants" description="Sizes, colours or other options with their own stock" />
          <div className="flex flex-col gap-3 p-5">
            {optionDrafts.map((o, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <Input value={o.name} onChange={(e) => setOptionDrafts((d) => d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Option, e.g. Size" />
                <Input value={o.values} onChange={(e) => setOptionDrafts((d) => d.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} placeholder="Values, comma separated: S, M, L, XL" />
                <Button type="button" variant="ghost" onClick={() => setOptionDrafts((d) => d.filter((_, j) => j !== i))} aria-label="Remove option"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {optionDrafts.length < 3 && <Button type="button" variant="outline" size="sm" onClick={() => setOptionDrafts((d) => [...d, { name: d.length === 0 ? "Size" : d.length === 1 ? "Color" : "", values: "" }])}><Plus className="h-3.5 w-3.5" /> Add option</Button>}
              {parsedOptions.length > 0 && <Button type="button" size="sm" onClick={generateVariants}><Wand2 className="h-3.5 w-3.5" /> {hasVariants ? "Update variants" : "Create variants"}</Button>}
              {hasVariants && <Button type="button" variant="ghost" size="sm" onClick={() => { setP((x) => ({ ...x, variants: [], options: [] })); setOptionDrafts([]); }}>Remove all variants</Button>}
            </div>
            {hasVariants && (
              <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-2 text-left">Variant</th><th className="px-3 py-2 text-left">Price (RWF)</th><th className="px-3 py-2 text-left">Stock</th><th className="px-3 py-2 text-left">SKU</th></tr></thead>
                  <tbody>
                    {(p.variants ?? []).map((v, i) => (
                      <tr key={v.title} className="border-t border-zinc-100">
                        <td className="px-3 py-2 font-medium">{v.title}</td>
                        <td className="px-3 py-2"><Input className="h-8 w-28" inputMode="numeric" placeholder={String(p.price || 0)} value={v.price != null ? String(v.price) : ""} onChange={(e) => updateVariant(i, { price: toInt(e.target.value) })} /></td>
                        <td className="px-3 py-2"><Input className="h-8 w-20" inputMode="numeric" value={String(v.stockQuantity)} onChange={(e) => updateVariant(i, { stockQuantity: toInt(e.target.value) ?? 0 })} /></td>
                        <td className="px-3 py-2"><Input className="h-8 w-28" value={v.sku ?? ""} onChange={(e) => updateVariant(i, { sku: e.target.value })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Search engine listing" description="How this product appears on Google and when shared" />
          <div className="flex flex-col gap-4 p-5">
            <Field label="Page title"><Input value={p.seoTitle ?? ""} maxLength={120} onChange={(e) => set("seoTitle", e.target.value)} placeholder={p.name || "Defaults to product name"} /></Field>
            <Field label="Meta description"><Textarea rows={2} maxLength={300} value={p.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value)} placeholder="Defaults to the start of your description" /></Field>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 p-5">
          <Field label="Status">
            <Select value={p.status} onChange={(e) => set("status", e.target.value as "ACTIVE" | "DRAFT")}>
              <option value="ACTIVE">Active — visible in store</option>
              <option value="DRAFT">Draft — hidden</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={p.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured product</label>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <p className="font-semibold">Inventory</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.trackInventory} onChange={(e) => set("trackInventory", e.target.checked)} /> Track stock quantity</label>
          {p.trackInventory && !hasVariants && <Field label="Quantity in stock"><Input inputMode="numeric" value={String(p.stockQuantity)} onChange={(e) => set("stockQuantity", toInt(e.target.value) ?? 0)} /></Field>}
          {p.trackInventory && hasVariants && <p className="text-sm text-zinc-500">Stock is tracked per variant.</p>}
        </Card>
        <div className="sticky bottom-4 flex gap-2">
          <Button className="flex-1" size="lg" onClick={save} disabled={pending || !p.name}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {p.id ? "Save changes" : "Create product"}
          </Button>
        </div>
        {saved && <p className="text-center text-sm text-green-700">Saved</p>}
      </div>
    </div>
  );
}
