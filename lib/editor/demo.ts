import type { StorefrontCtx } from "@/components/storefront/types";
import type { TemplateDef } from "@/templates";
import { slugify } from "@/lib/slug";

/** Sample catalogue for template previews (no database involved). */
export function demoCtx(t: TemplateDef, store: Partial<StorefrontCtx["store"]> = {}): StorefrontCtx {
  const now = Date.now();
  return {
    store: {
      id: "demo", name: store.name ?? "Your Store", slug: "demo", description: store.description ?? null,
      phone: store.phone ?? "+250 788 000 000", email: store.email ?? "hello@yourstore.rw", location: store.location ?? "Kigali, Rwanda", currency: "RWF",
    },
    base: "",
    theme: t.theme,
    categories: t.demoCategories.map((c, i) => ({ id: `cat-${i}`, name: c.name, slug: slugify(c.name), imageUrl: c.image })),
    products: t.demoProducts.map((p, i) => ({
      id: `demo-${i}`, name: p.name, slug: slugify(p.name), price: p.price, compareAtPrice: p.compareAtPrice ?? null, image: p.image,
      categorySlug: slugify(p.category), featured: i < 4, createdAt: now - i * 1000, inStock: true,
    })),
    editing: true,
    demo: true,
  };
}
