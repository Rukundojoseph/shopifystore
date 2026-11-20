import type { StorefrontProduct } from "./types";

export type ProductQuery = { source?: string; category?: string; sort?: string; limit?: number };

/** Which products a grid shows (shared by the Product grid section and element). */
export function pickProducts(q: ProductQuery, products: StorefrontProduct[]): StorefrontProduct[] {
  let items = [...products];
  if (q.source === "featured") items = items.filter((p) => p.featured);
  if (q.source === "category" && q.category) items = items.filter((p) => p.categorySlug === q.category);
  const sort = q.sort;
  items.sort((a, b) =>
    sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : b.createdAt - a.createdAt,
  );
  const limit = Number.isFinite(q.limit) ? Math.round(q.limit!) : 8;
  return items.slice(0, Math.max(1, Math.min(24, limit)));
}
