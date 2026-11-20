import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { resolveStore } from "@/lib/tenants/resolve";
import { StorePage } from "@/components/storefront/store-page";
import { SystemPage } from "@/components/storefront/site-frame";
import { ProductCard } from "@/components/storefront/sections";
import { ProductPurchase } from "@/components/storefront/product-purchase";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { href } from "@/components/storefront/types";
import { storeMetadata } from "@/lib/storefront/metadata";

type P = { params: Promise<{ store: string; slug: string }>; searchParams: Promise<{ preview?: string }> };

async function getProduct(key: string, slug: string) {
  const store = await resolveStore(key);
  if (!store) return null;
  return db.product.findFirst({
    where: { storeId: store.id, slug, status: "ACTIVE" },
    include: { variants: { orderBy: { position: "asc" } }, category: true },
  });
}

export async function generateMetadata({ params }: P) {
  const { store, slug } = await params;
  const p = await getProduct(store, slug);
  if (!p) return {};
  return storeMetadata(store, { title: p.seoTitle || p.name, description: p.seoDescription || p.description?.slice(0, 160), image: p.images[0] });
}

export default async function ProductPage({ params, searchParams }: P) {
  const { store, slug } = await params;
  const { preview } = await searchParams;
  const product = await getProduct(store, slug);
  if (!product) notFound();

  const options = (Array.isArray(product.options) ? product.options : []) as { name: string; values: string[] }[];

  return (
    <StorePage storeKey={store} preview={preview === "draft"}>
      {({ ctx, config }) => {
        const related = ctx.products.filter((p) => p.id !== product.id && p.categorySlug && p.categorySlug === product.category?.slug).slice(0, 4);
        return (
          <SystemPage kind="product" sections={config.systemPages?.product} ctx={ctx}>
          <div className="mx-auto max-w-6xl px-4 py-8 @2xl:px-6 @2xl:py-12">
            <nav className="mb-6 text-sm opacity-60">
              <Link href={href(ctx, "/products")}>Products</Link>
              {product.category && <> / <Link href={href(ctx, `/collections/${product.category.slug}`)}>{product.category.name}</Link></>}
            </nav>
            <div className="grid gap-8 @3xl:grid-cols-2 @3xl:gap-12">
              <ProductGallery images={product.images} name={product.name} />
              <div className="flex flex-col gap-6">
                <h1 className="text-3xl font-semibold tracking-tight @2xl:text-4xl" style={{ fontFamily: "var(--sf-heading)" }}>{product.name}</h1>
                <ProductPurchase
                  storeCurrency={ctx.store.currency}
                  primaryColor={ctx.theme.primaryColor}
                  cartHref={href(ctx, "/cart")}
                  product={{
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    price: product.price,
                    compareAtPrice: product.compareAtPrice,
                    image: product.images[0] ?? null,
                    stock: product.trackInventory ? product.stockQuantity : 9999,
                    options,
                    variants: product.variants.map((v) => ({
                      id: v.id,
                      title: v.title,
                      optionValues: v.optionValues as Record<string, string>,
                      price: v.price ?? product.price,
                      stock: product.trackInventory ? v.stockQuantity : 9999,
                    })),
                  }}
                />
                {product.description && <div className="whitespace-pre-line border-t border-current/10 pt-6 text-sm leading-relaxed opacity-80">{product.description}</div>}
              </div>
            </div>
            {related.length > 0 && (
              <section className="mt-16">
                <h2 className="mb-6 text-2xl font-semibold" style={{ fontFamily: "var(--sf-heading)" }}>You may also like</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 @2xl:grid-cols-4">
                  {related.map((p) => <ProductCard key={p.id} product={p} ctx={ctx} />)}
                </div>
              </section>
            )}
          </div>
          </SystemPage>
        );
      }}
    </StorePage>
  );
}
