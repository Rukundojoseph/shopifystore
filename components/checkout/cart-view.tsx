/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/storefront/cart";
import { formatMoney } from "@/lib/money";

export function CartView({ currency, checkoutHref, shopHref, productBase }: { currency: string; checkoutHref: string; shopHref: string; productBase: string }) {
  const cart = useCart();
  if (!cart.ready) return <div className="min-h-[50vh]" />;
  if (!cart.lines.length) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--sf-heading)" }}>Your cart is empty</h1>
        <Link href={shopHref} className="px-6 py-3 text-sm font-semibold text-white" style={{ background: "var(--sf-primary)", borderRadius: "var(--sf-radius-btn)" }}>Continue shopping</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 @2xl:px-6 @5xl:grid-cols-[1fr_320px]">
      <div>
        <h1 className="mb-6 text-3xl font-semibold" style={{ fontFamily: "var(--sf-heading)" }}>Your cart</h1>
        <ul className="divide-y divide-current/10 border-y border-current/10">
          {cart.lines.map((l) => (
            <li key={l.productId + (l.variantId ?? "")} className="flex gap-4 py-4">
              <Link href={`${productBase}/${l.slug}`} className="h-24 w-24 shrink-0 overflow-hidden bg-black/5" style={{ borderRadius: "var(--sf-radius)" }}>
                {l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}
              </Link>
              <div className="flex flex-1 flex-col gap-1">
                <p className="font-medium">{l.name}</p>
                {l.variantName && <p className="text-sm opacity-60">{l.variantName}</p>}
                <p className="text-sm">{formatMoney(l.price, currency)}</p>
                <div className="mt-auto flex items-center gap-3">
                  <div className="flex items-center border border-current/20" style={{ borderRadius: "var(--sf-radius-btn)" }}>
                    <button className="p-2" onClick={() => cart.setQuantity(l.productId, l.variantId, l.quantity - 1)} aria-label="Decrease"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-8 text-center text-sm">{l.quantity}</span>
                    <button className="p-2" onClick={() => cart.setQuantity(l.productId, l.variantId, l.quantity + 1)} aria-label="Increase"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <button onClick={() => cart.remove(l.productId, l.variantId)} className="p-2 opacity-60 hover:opacity-100" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="font-semibold">{formatMoney(l.price * l.quantity, currency)}</p>
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit border border-current/10 p-6" style={{ borderRadius: "var(--sf-radius)" }}>
        <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-semibold">{formatMoney(cart.subtotal, currency)}</span></div>
        <p className="mt-1 text-xs opacity-60">Delivery calculated at checkout.</p>
        <Link href={checkoutHref} className="mt-6 block px-6 py-3 text-center text-sm font-semibold text-white" style={{ background: "var(--sf-primary)", borderRadius: "var(--sf-radius-btn)" }}>Checkout</Link>
      </aside>
    </div>
  );
}
