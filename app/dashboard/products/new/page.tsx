import Link from "next/link";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/dashboard/product-form";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const { store } = await requireStore("products.manage");
  const categories = await db.category.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <Link href="/dashboard/products" className="text-sm text-zinc-500 hover:text-zinc-900">← Products</Link>
      <PageHeader title="Add product" />
      <ProductForm categories={categories} />
    </>
  );
}
