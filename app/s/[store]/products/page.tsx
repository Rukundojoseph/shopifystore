import Link from "next/link";
import { StorePage } from "@/components/storefront/store-page";
import { ProductCard } from "@/components/storefront/sections";
import { href } from "@/components/storefront/types";
import { storeMetadata } from "@/lib/storefront/metadata";

type P = { params: Promise<{ store: string }>; searchParams: Promise<{ q?: string; sort?: string; preview?: string }> };

export async function generateMetadata({ params }: P) {
  return storeMetadata((await params).store, { title: "All products" });
}

export default async function ProductsPage({ params, searchParams }: P) {
  const { store } = await params;
  const { q, sort, preview } = await searchParams;
  return (
    <StorePage storeKey={store} preview={preview === "draft"}>
      {({ ctx }) => {
        const term = (q ?? "").trim().toLowerCase();
        const items = ctx.products
          .filter((p) => !term || p.name.toLowerCase().includes(term))
          .sort((a, b) => (sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : b.createdAt - a.createdAt));
        return (
          <div className="mx-auto max-w-6xl px-4 py-10 @2xl:px-6">
            <div className="mb-6 flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--sf-heading)" }}>{term ? `Results for “${q}”` : "All products"}</h1>
                <p className="mt-1 text-sm opacity-60">{items.length} products</p>
              </div>
              <form className="flex gap-2" method="get">
                <input name="q" defaultValue={q} placeholder="Search" className="w-40 border border-current/20 bg-transparent px-3 py-2 text-sm @2xl:w-56" style={{ borderRadius: "var(--sf-radius)" }} />
                <select name="sort" defaultValue={sort} className="border border-current/20 bg-transparent px-3 py-2 text-sm" style={{ borderRadius: "var(--sf-radius)" }}>
                  <option value="">Newest</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </select>
                <button className="px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--sf-primary)", borderRadius: "var(--sf-radius-btn)" }}>Go</button>
              </form>
            </div>
            {ctx.categories.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                {ctx.categories.map((c) => (
                  <Link key={c.id} href={href(ctx, `/collections/${c.slug}`)} className="border border-current/15 px-3 py-1.5 text-sm" style={{ borderRadius: "var(--sf-radius-btn)" }}>{c.name}</Link>
                ))}
              </div>
            )}
            {items.length ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 @2xl:grid-cols-3 @5xl:grid-cols-4">
                {items.map((p) => <ProductCard key={p.id} product={p} ctx={ctx} />)}
              </div>
            ) : (
              <p className="py-20 text-center opacity-60">No products found.</p>
            )}
          </div>
        );
      }}
    </StorePage>
  );
}
