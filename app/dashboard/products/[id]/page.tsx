import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { Alert, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ProductForm } from "@/components/dashboard/product-form";
import { deleteProductAction } from "../actions";
import { storePathUrl } from "@/lib/urls";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { store } = await requireStore("products.manage");
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p, categories] = await Promise.all([
    db.product.findFirst({ where: { id, storeId: store.id }, include: { variants: { orderBy: { position: "asc" } } } }),
    db.category.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!p) notFound();

  return (
    <>
      <Link href="/dashboard/products" className="text-sm text-zinc-500 hover:text-zinc-900">← Products</Link>
      <PageHeader
        title={p.name}
        actions={
          <>
            <a href={storePathUrl(store.slug, `/products/${p.slug}?preview=draft`)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50">View in store</a>
            <form action={deleteProductAction}>
              <input type="hidden" name="id" value={p.id} />
              <ConfirmButton message="Delete this product? This cannot be undone." variant="outline" className="text-red-600">Delete</ConfirmButton>
            </form>
          </>
        }
      />
      {created && <div className="mb-4"><Alert tone="success">Product created.</Alert></div>}
      <ProductForm
        categories={categories}
        initial={{
          id: p.id, name: p.name, description: p.description ?? "", price: p.price, compareAtPrice: p.compareAtPrice, sku: p.sku ?? "",
          stockQuantity: p.stockQuantity, trackInventory: p.trackInventory, status: p.status, featured: p.featured, categoryId: p.categoryId,
          images: p.images, options: (Array.isArray(p.options) ? p.options : []) as { name: string; values: string[] }[],
          variants: p.variants.map((v) => ({ id: v.id, title: v.title, optionValues: v.optionValues as Record<string, string>, sku: v.sku ?? "", price: v.price, stockQuantity: v.stockQuantity })),
          seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "",
        }}
      />
    </>
  );
}
