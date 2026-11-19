"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Check } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { useCart } from "./cart";
import { contrastText } from "./theme";

type Variant = { id: string; title: string; optionValues: Record<string, string>; price: number; stock: number };
type Props = {
  storeCurrency: string;
  primaryColor: string;
  cartHref: string;
  product: {
    id: string; slug: string; name: string; price: number; compareAtPrice: number | null; image: string | null; stock: number;
    options: { name: string; values: string[] }[]; variants: Variant[];
  };
};

export function ProductPurchase({ product, storeCurrency, primaryColor, cartHref }: Props) {
  const cart = useCart();
  const router = useRouter();
  const hasVariants = product.variants.length > 0;
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    hasVariants ? { ...(product.variants.find((v) => v.stock > 0) ?? product.variants[0]).optionValues } : {},
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = useMemo(
    () => (hasVariants ? product.variants.find((v) => Object.entries(v.optionValues).every(([k, val]) => selected[k] === val)) ?? null : null),
    [hasVariants, product.variants, selected],
  );
  const price = variant?.price ?? product.price;
  const stock = hasVariants ? variant?.stock ?? 0 : product.stock;
  const available = stock > 0;

  function add(goToCart: boolean) {
    cart.add({
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name,
      variantName: variant?.title ?? null,
      price,
      image: product.image,
      quantity: qty,
      slug: product.slug,
    });
    if (goToCart) router.push(cartHref);
    else {
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    }
  }

  const btn = { background: "var(--sf-primary)", color: contrastText(primaryColor), borderRadius: "var(--sf-radius-btn)" };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-2xl font-semibold">
        {formatMoney(price, storeCurrency)}
        {product.compareAtPrice && product.compareAtPrice > price && <span className="ml-3 text-base font-normal line-through opacity-50">{formatMoney(product.compareAtPrice, storeCurrency)}</span>}
      </p>

      {product.options.map((opt) => (
        <div key={opt.name} className="flex flex-col gap-2">
          <p className="text-sm font-medium">{opt.name}: <span className="opacity-70">{selected[opt.name]}</span></p>
          <div className="flex flex-wrap gap-2">
            {opt.values.map((val) => {
              const active = selected[opt.name] === val;
              return (
                <button
                  key={val}
                  onClick={() => setSelected((s) => ({ ...s, [opt.name]: val }))}
                  className={`min-w-12 border px-4 py-2 text-sm ${active ? "border-[var(--sf-primary)] font-semibold" : "border-current/20"}`}
                  style={{ borderRadius: "var(--sf-radius-btn)" }}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className={`text-sm ${available ? "text-green-700" : "text-red-600"}`}>
        {available ? (stock < 10 ? `Only ${stock} left` : "In stock") : hasVariants && !variant ? "This combination is unavailable" : "Sold out"}
      </p>

      <div className="flex flex-col gap-3 @2xl:flex-row">
        <div className="flex items-center border border-current/20" style={{ borderRadius: "var(--sf-radius-btn)" }}>
          <button className="px-3 py-3" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease"><Minus className="h-4 w-4" /></button>
          <span className="w-10 text-center text-sm font-semibold">{qty}</span>
          <button className="px-3 py-3" onClick={() => setQty((q) => Math.min(stock, q + 1, 99))} aria-label="Increase"><Plus className="h-4 w-4" /></button>
        </div>
        <button disabled={!available} onClick={() => add(false)} className="flex-1 border border-current/30 px-6 py-3 text-sm font-semibold disabled:opacity-40" style={{ borderRadius: "var(--sf-radius-btn)" }}>
          {added ? <span className="inline-flex items-center gap-2"><Check className="h-4 w-4" /> Added</span> : "Add to cart"}
        </button>
        <button disabled={!available} onClick={() => add(true)} className="flex-1 px-6 py-3 text-sm font-semibold disabled:opacity-40" style={btn}>
          Buy now
        </button>
      </div>
    </div>
  );
}
