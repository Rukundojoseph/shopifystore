import type { Theme } from "@/lib/editor/schema";

export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  categorySlug: string | null;
  featured: boolean;
  createdAt: number;
  inStock: boolean;
  /** Products with options must be added from their product page (to pick a variant). */
  hasVariants: boolean;
};

export type StorefrontCategory = { id: string; name: string; slug: string; imageUrl: string | null };

export type StorefrontCtx = {
  store: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    location: string | null;
    currency: string;
  };
  /** "" when served on the store's own (sub)domain, "/s/<slug>" otherwise. */
  base: string;
  theme: Theme;
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
  /** Rendered inside the editor canvas: links are inert, empty states shown. */
  editing?: boolean;
  /** Template preview with sample data: cart and checkout disabled. */
  demo?: boolean;
};

export function href(ctx: Pick<StorefrontCtx, "base">, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (!ctx.base) return path;
  return path === "/" ? ctx.base : ctx.base + path;
}
