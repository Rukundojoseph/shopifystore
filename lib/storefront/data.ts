import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { siteConfigSchema, type SiteConfig } from "@/lib/editor/schema";
import { buildSiteConfig } from "@/templates";
import { resolveStore, type ResolvedStore } from "@/lib/tenants/resolve";
import type { StorefrontCtx, StorefrontProduct } from "@/components/storefront/types";

export async function storeBase(slug: string): Promise<string> {
  return (await headers()).get("x-sh-store-host") ? "" : `/s/${slug}`;
}

async function canPreview(store: ResolvedStore): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "PLATFORM_ADMIN") return true;
  const m = await db.storeMember.findUnique({ where: { storeId_userId: { storeId: store.id, userId: user.id } } });
  return !!m;
}

export function parseConfig(raw: unknown, store: { name: string; templateKey: string | null; description: string | null }): SiteConfig {
  const parsed = siteConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : buildSiteConfig(store.templateKey ?? "general", store.name, store.description);
}

export const loadProducts = cache(async (storeId: string): Promise<StorefrontProduct[]> => {
  const rows = await db.product.findMany({
    where: { storeId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, name: true, slug: true, price: true, compareAtPrice: true, images: true, featured: true,
      createdAt: true, stockQuantity: true, trackInventory: true,
      category: { select: { slug: true } },
      variants: { select: { stockQuantity: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    image: p.images[0] ?? null,
    categorySlug: p.category?.slug ?? null,
    featured: p.featured,
    createdAt: p.createdAt.getTime(),
    inStock: !p.trackInventory || (p.variants.length ? p.variants.some((v) => v.stockQuantity > 0) : p.stockQuantity > 0),
  }));
});

/**
 * Loads a storefront for public rendering. Only the published config is served
 * unless `?preview=draft` is requested by a member of the store.
 */
export const loadStorefront = cache(async (storeKey: string, wantDraft = false) => {
  const store = await resolveStore(storeKey);
  if (!store || store.status === "SUSPENDED") notFound();

  const previewing = wantDraft && (await canPreview(store));
  if (store.status !== "PUBLISHED" && !previewing && !(await canPreview(store))) {
    return { store, config: null, ctx: null, previewing: false, comingSoon: true as const };
  }

  const config = parseConfig(previewing || !store.publishedConfig ? store.draftConfig : store.publishedConfig, store);
  const [products, categories] = await Promise.all([
    loadProducts(store.id),
    db.category.findMany({ where: { storeId: store.id }, orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, imageUrl: true } }),
  ]);
  const ctx: StorefrontCtx = {
    store: { id: store.id, name: store.name, slug: store.slug, description: store.description, phone: store.phone, email: store.email, location: store.location, currency: store.currency },
    base: await storeBase(store.slug),
    theme: config.theme,
    products,
    categories,
  };
  return { store, config, ctx, previewing, comingSoon: false as const };
});

export type LoadedStorefront = Awaited<ReturnType<typeof loadStorefront>>;
