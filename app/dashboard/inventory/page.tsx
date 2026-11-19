import Link from "next/link";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { updateStockAction } from "../products/actions";

export const metadata = { title: "Inventory" };

function StockForm({ id, kind, value }: { id: string; kind: "product" | "variant"; value: number }) {
  return (
    <form action={updateStockAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <input name="stock" type="number" min={0} defaultValue={value} className="h-8 w-24 rounded-md border border-zinc-300 px-2 text-sm" />
      <button className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50">Save</button>
    </form>
  );
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ low?: string }> }) {
  const { store } = await requireStore("products.manage");
  const { low } = await searchParams;
  const products = await db.product.findMany({ where: { storeId: store.id, trackInventory: true }, orderBy: { name: "asc" }, include: { variants: { orderBy: { position: "asc" } } } });
  type Row = { key: string; id: string; kind: "product" | "variant"; productId: string; name: string; variant: string | null; sku: string | null; stock: number };
  const rows = products.flatMap((p): Row[] =>
    p.variants.length
      ? p.variants.map((v) => ({ key: v.id, id: v.id, kind: "variant", productId: p.id, name: p.name, variant: v.title, sku: v.sku, stock: v.stockQuantity }))
      : [{ key: p.id, id: p.id, kind: "product", productId: p.id, name: p.name, variant: null, sku: p.sku, stock: p.stockQuantity }],
  ).filter((r) => !low || r.stock <= 5);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Update stock levels. Stock is reserved automatically when customers place orders."
        actions={<Link href={low ? "/dashboard/inventory" : "/dashboard/inventory?low=1"} className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50">{low ? "Show all" : "Low stock only"}</Link>}
      />
      <Card>
        {rows.length ? (
          <Table>
            <thead><tr><Th>Product</Th><Th>SKU</Th><Th>Status</Th><Th>Quantity</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <Td><Link href={`/dashboard/products/${r.productId}`} className="font-medium hover:text-brand-700">{r.name}</Link>{r.variant && <p className="text-xs text-zinc-500">{r.variant}</p>}</Td>
                  <Td className="text-zinc-500">{r.sku ?? "—"}</Td>
                  <Td>{r.stock === 0 ? <Badge color="red">Out of stock</Badge> : r.stock <= 5 ? <Badge color="yellow">Low</Badge> : <Badge color="green">In stock</Badge>}</Td>
                  <Td><StockForm id={r.id} kind={r.kind} value={r.stock} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={low ? "Nothing is low on stock" : "No tracked products"} />
        )}
      </Card>
    </>
  );
}
