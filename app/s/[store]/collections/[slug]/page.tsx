import { notFound } from "next/navigation";
import Link from "next/link";
import { StorePage } from "@/components/storefront/store-page";
import { ProductCard } from "@/components/storefront/sections";
import { href } from "@/components/storefront/types";
import { storeMetadata } from "@/lib/storefront/metadata";
import { resolveStore } from "@/lib/tenants/resolve";
import { db } from "@/lib/db";

type P = { params: Promise<{ store: string; slug: string }> };

export async function generateMetadata({ params }: P) {
  const { store: key, slug } = await params;
  const store = await resolveStore(key);
  const cat = store ? await db.category.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } }) : null;
  return storeMetadata(key, { title: cat?.name, image: cat?.imageUrl });
}

export default async function CollectionPage({ params }: P) {
  const { store, slug } = await params;
  return (
    <StorePage storeKey={store}>
      {({ ctx }) => {
        const cat = ctx.categories.find((c) => c.slug === slug);
        if (!cat) notFound();
        const items = ctx.products.filter((p) => p.categorySlug === slug);
        return (
          <div className="mx-auto max-w-6xl px-4 py-10 @2xl:px-6">
            <nav className="mb-2 text-sm opacity-60"><Link href={href(ctx, "/products")}>All products</Link> / {cat.name}</nav>
            <h1 className="mb-8 text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--sf-heading)" }}>{cat.name}</h1>
            {items.length ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 @2xl:grid-cols-3 @5xl:grid-cols-4">
                {items.map((p) => <ProductCard key={p.id} product={p} ctx={ctx} />)}
              </div>
            ) : (
              <p className="py-20 text-center opacity-60">No products in this category yet.</p>
            )}
          </div>
        );
      }}
    </StorePage>
  );
}
