import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { formatMoney } from "@/lib/money";
import { formatRwandaPhone, normalizeRwandaPhone } from "@/lib/phone";
import { Button, Card, EmptyState, Input, PageHeader, Table, Td, Th, cn } from "@/components/ui";
import { ORDER_STATUS_LABEL, OrderPaymentBadge, OrderStatusBadge } from "@/components/dashboard/status";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const { store } = await requireStore("orders.view");
  const { q, status, page } = await searchParams;
  const take = 50;
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;
  const term = q?.trim();
  const phone = term ? normalizeRwandaPhone(term) : null;
  const where: Prisma.OrderWhereInput = {
    storeId: store.id,
    ...(status && status in ORDER_STATUS_LABEL ? { status: status as OrderStatus } : {}),
    ...(term
      ? { OR: [
          ...(/^#?\d+$/.test(term) ? [{ number: Number(term.replace("#", "")) }] : []),
          { customerName: { contains: term, mode: "insensitive" as const } },
          { customerPhone: { contains: phone ?? (term.replace(/\D/g, "") || term) } },
        ] }
      : {}),
  };
  const [orders, count, counts] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { _count: { select: { items: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { storeId: store.id }, _count: true }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return (
    <>
      <PageHeader title="Orders" description={`${count} orders`} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[["", "All"], ...Object.entries(ORDER_STATUS_LABEL)].map(([k, label]) => (
          <Link key={k} href={k ? `/dashboard/orders?status=${k}` : "/dashboard/orders"} className={cn("whitespace-nowrap rounded-full border px-3 py-1 text-sm", (status ?? "") === k ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400")}>
            {label}{k && byStatus[k] ? ` · ${byStatus[k]}` : ""}
          </Link>
        ))}
      </div>
      <Card>
        <form className="flex gap-2 border-b border-zinc-100 p-4">
          {status && <input type="hidden" name="status" value={status} />}
          <Input name="q" defaultValue={q} placeholder="Search order #, customer name or phone" className="max-w-md" />
          <Button variant="outline">Search</Button>
        </form>
        {orders.length ? (
          <Table>
            <thead><tr><Th>Order</Th><Th>Date</Th><Th>Customer</Th><Th>Items</Th><Th>Payment</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <Td><Link href={`/dashboard/orders/${o.id}`} className="font-medium text-brand-700">#{o.number}</Link></Td>
                  <Td className="whitespace-nowrap text-zinc-500">{o.createdAt.toLocaleString("en-RW", { dateStyle: "medium", timeStyle: "short" })}</Td>
                  <Td><p>{o.customerName}</p><p className="text-xs text-zinc-500">{formatRwandaPhone(o.customerPhone)}</p></Td>
                  <Td>{o._count.items}</Td>
                  <Td><div className="flex flex-col items-start gap-1"><OrderPaymentBadge status={o.paymentStatus} /><span className="text-xs text-zinc-500">{o.paymentMethod === "MTN_MOMO" ? "MoMo" : "On delivery"}</span></div></Td>
                  <Td><OrderStatusBadge status={o.status} /></Td>
                  <Td className="text-right font-medium">{formatMoney(o.total, o.currency)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No orders found" />
        )}
        {count > take && (
          <div className="flex justify-between p-4 text-sm">
            {skip > 0 ? <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(skip / take) })}`}>← Newer</Link> : <span />}
            {skip + take < count && <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(skip / take + 2) })}`}>Older →</Link>}
          </div>
        )}
      </Card>
    </>
  );
}
