"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  price: number; // display only — the server re-prices at checkout
  image: string | null;
  quantity: number;
  slug: string;
};

type CartState = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (line: CartLine) => void;
  setQuantity: (productId: string, variantId: string | null, qty: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);
const keyFor = (storeId: string) => `sh_cart_${storeId}`;
const same = (a: CartLine, p: string, v: string | null) => a.productId === p && a.variantId === v;

export function CartProvider({ storeId, children }: { storeId: string; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyFor(storeId));
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, [storeId]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(keyFor(storeId), JSON.stringify(lines));
    } catch {}
  }, [lines, ready, storeId]);

  const add = useCallback((line: CartLine) => {
    setLines((prev) => {
      const existing = prev.find((l) => same(l, line.productId, line.variantId));
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: Math.min(99, l.quantity + line.quantity) } : l));
      return [...prev, line];
    });
  }, []);
  const setQuantity = useCallback((p: string, v: string | null, qty: number) => {
    setLines((prev) => (qty <= 0 ? prev.filter((l) => !same(l, p, v)) : prev.map((l) => (same(l, p, v) ? { ...l, quantity: Math.min(99, qty) } : l))));
  }, []);
  const remove = useCallback((p: string, v: string | null) => setLines((prev) => prev.filter((l) => !same(l, p, v))), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((n, l) => n + l.price * l.quantity, 0),
      add, setQuantity, remove, clear,
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) {
    // Editor canvas / template preview render without a provider.
    return { lines: [], count: 0, subtotal: 0, ready: true, add: () => {}, setQuantity: () => {}, remove: () => {}, clear: () => {} };
  }
  return ctx;
}
