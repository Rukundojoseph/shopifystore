/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { formatMoney } from "@/lib/money";
import { getStorePlan } from "@/lib/plans";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Select, Table, Td, Th, Button } from "@/components/ui";

export const metadata = { title: "Products" };

type SP = { q?: string; category?: string; status?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { store } = await requireStore("products.manage");
  const { q, category, status } = await searchParams;
  const where: Prisma.ProductWhereInput = {
    storeId: store.id,
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
    ...(category ? { categoryId: category } : {}),
    ...(status === "ACTIVE" || status === "DRAFT" ? { status } : {}),
  };
  const [products, categories, total, { plan }] = await Promise.all([
    db.product.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { category: true, variants: { select: { stockQuantity: true } } } }),
    db.category.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" } }),
    db.product.count({ where: { storeId: store.id } }),
    getStorePlan(store.id),
  ]);

  return (
    <>
      <PageHeader
        title="Products"
        description={plan?.maxProducts ? `${total} of ${plan.maxProducts} products on the ${plan.name} plan` : `${total} products`}
        actions={<LinkButton href="/dashboard/products/new">Add product</LinkButton>}
      />
      <Card>
        <form className="flex flex-col gap-2 border-b border-zinc-100 p-4 sm:flex-row">
          <Input name="q" defaultValue={q} placeholder="Search by name or SKU" className="sm:max-w-xs" />
          <Select name="category" defaultValue={category ?? ""} className="sm:w-48">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select name="status" defaultValue={status ?? ""} className="sm:w-36">
            <option value="">Any status</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option>
          </Select>
          <Button variant="outline">Filter</Button>
        </form>
        {products.length ? (
          <Table>
            <thead><tr><Th></Th><Th>Product</Th><Th>Status</Th><Th>Stock</Th><Th>Category</Th><Th className="text-right">Price</Th></tr></thead>
            <tbody>
              {products.map((p) => {
                const stock = p.variants.length ? p.variants.reduce((n, v) => n + v.stockQuantity, 0) : p.stockQuantity;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <Td className="w-14"><div className="h-10 w-10 overflow-hidden rounded-md bg-zinc-100">{p.images[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}</div></Td>
                    <Td><Link href={`/dashboard/products/${p.id}`} className="font-medium text-zinc-900 hover:text-brand-700">{p.name}</Link>{p.variants.length > 0 && <p className="text-xs text-zinc-500">{p.variants.length} variants</p>}</Td>
                    <Td><Badge color={p.status === "ACTIVE" ? "green" : "gray"}>{p.status === "ACTIVE" ? "Active" : "Draft"}</Badge></Td>
                    <Td>{p.trackInventory ? <span className={stock <= 5 ? "font-medium text-red-600" : ""}>{stock} in stock</span> : <span className="text-zinc-400">Not tracked</span>}</Td>
                    <Td className="text-zinc-600">{p.category?.name ?? "—"}</Td>
                    <Td className="text-right font-medium">{formatMoney(p.price, p.currency)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={q || category || status ? "No matching products" : "Add your first product"} description="Products you add appear in your store's product grids and pages." action={<LinkButton href="/dashboard/products/new">Add product</LinkButton>} />
        )}
      </Card>
    </>
  );
}
