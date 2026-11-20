import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, LinkButton, PageHeader, Table, Td, Th, EmptyState, Alert } from "@/components/ui";
import { OrderStatusBadge, OrderPaymentBadge, PaymentStatusBadge } from "@/components/dashboard/status";
import { can } from "@/lib/tenants/permissions";
import { storeUrl } from "@/lib/urls";
import { momoAvailable } from "@/lib/payments/momo";

export const metadata = { title: "Overview" };

export default async function Overview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { store, role } = await requireStore();
  const showPayments = can(role, "payments.view");
  const { denied } = await searchParams;
  const sid = store.id;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [revenue, ordersToday, openOrders, productCount, lowStock, recent, customers, payments, awaiting] = await Promise.all([
    db.order.aggregate({ where: { storeId: sid, paymentStatus: "PAID", createdAt: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    db.order.count({ where: { storeId: sid, createdAt: { gte: todayStart } } }),
    db.order.count({ where: { storeId: sid, status: { in: ["PENDING", "PAID", "PROCESSING", "READY_FOR_DELIVERY"] } } }),
    db.product.count({ where: { storeId: sid } }),
    db.product.count({ where: { storeId: sid, status: "ACTIVE", trackInventory: true, stockQuantity: { lte: 5 }, variants: { none: {} } } }),
    db.order.findMany({ where: { storeId: sid }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.customer.count({ where: { storeId: sid } }),
    showPayments
      ? db.payment.findMany({ where: { storeId: sid, kind: "CUSTOMER_ORDER" }, orderBy: { createdAt: "desc" }, take: 6, include: { order: { select: { id: true, number: true } } } })
      : Promise.resolve([]),
    db.order.count({ where: { storeId: sid, paymentStatus: { not: "PAID" }, status: { notIn: ["CANCELLED"] } } }),
  ]);

  const checklist = [
    { done: !!store.templateKey, label: "Choose a template", href: "/store-builder/templates" },
    { done: !!store.draftConfig && store.updatedAt.getTime() - store.createdAt.getTime() > 5000, label: "Customise your website", href: "/store-builder/editor" },
    { done: productCount > 0, label: "Add your first product", href: "/dashboard/products/new" },
    { done: !!store.settings && (store.settings.acceptCashOnDelivery || store.settings.acceptMomo), label: "Set up payments & delivery", href: "/dashboard/settings#payments" },
    { done: store.status === "PUBLISHED", label: "Publish your store", href: "/store-builder/editor" },
  ];
  const remaining = checklist.filter((c) => !c.done).length;

  const stats = [
    { label: "Sales this month", value: formatMoney(revenue._sum.total ?? 0, store.currency), sub: `${revenue._count} paid orders` },
    { label: "Orders today", value: String(ordersToday), sub: `${openOrders} open · ${awaiting} awaiting payment` },
    { label: "Products", value: String(productCount), sub: lowStock ? `${lowStock} low on stock` : "Stock healthy" },
    { label: "Customers", value: String(customers), sub: "All time" },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back`}
        description={store.status === "PUBLISHED" ? <>Your store is live at <a className="text-brand-700 underline" href={storeUrl(store.slug)} target="_blank" rel="noreferrer">{storeUrl(store.slug).replace(/^https?:\/\//, "")}</a></> : "Your store is in draft. Finish setup and publish when you're ready."}
        actions={<LinkButton href="/dashboard/products/new">Add product</LinkButton>}
      />
      {denied && <div className="mb-4"><Alert tone="warning">You don&apos;t have permission to open that page. Ask the store owner for access.</Alert></div>}
      {momoAvailable().mode === "simulator" && <div className="mb-4"><Alert tone="info">MTN MoMo credentials are not set, so checkout uses the <b>dev payment simulator</b>. No real money moves.</Alert></div>}

      {remaining > 0 && (
        <Card className="mb-6">
          <CardHeader title="Get your store ready" description={`${checklist.length - remaining} of ${checklist.length} steps complete`} />
          <ul className="divide-y divide-zinc-100">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-zinc-50">
                  {c.done ? <CheckCircle2 className="h-5 w-5 text-brand-600" /> : <Circle className="h-5 w-5 text-zinc-300" />}
                  <span className={c.done ? "text-zinc-400 line-through" : "font-medium"}>{c.label}</span>
                  {!c.done && <ArrowRight className="ml-auto h-4 w-4 text-zinc-400" />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Recent orders" action={<Link href="/dashboard/orders" className="text-sm text-brand-700 hover:underline">View all</Link>} />
        {recent.length ? (
          <Table>
            <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Total</Th><Th>Payment</Th><Th>Status</Th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <Td><Link href={`/dashboard/orders/${o.id}`} className="font-medium text-brand-700">#{o.number}</Link></Td>
                  <Td>{o.customerName}</Td>
                  <Td>{formatMoney(o.total, o.currency)}</Td>
                  <Td><OrderPaymentBadge status={o.paymentStatus} /></Td>
                  <Td><OrderStatusBadge status={o.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No orders yet" description="When customers buy from your store, orders appear here." />
        )}
      </Card>
      {showPayments && (
        <Card>
          <CardHeader title="Recent payments" action={<Link href="/dashboard/payments" className="text-sm text-brand-700 hover:underline">View all</Link>} />
          {payments.length ? (
            <Table>
              <thead><tr><Th>Date</Th><Th>Order</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <Td className="whitespace-nowrap text-zinc-500">{p.createdAt.toLocaleString("en-RW", { dateStyle: "medium", timeStyle: "short" })}</Td>
                    <Td>{p.order ? <Link className="font-medium text-brand-700" href={`/dashboard/orders/${p.order.id}`}>#{p.order.number}</Link> : "—"}</Td>
                    <Td><PaymentStatusBadge status={p.status} /></Td>
                    <Td className="text-right font-medium">{formatMoney(p.amount, p.currency)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No payments yet" description="MoMo and pay-on-delivery payments appear here as customers check out." />
          )}
        </Card>
      )}
      </div>
    </>
  );
}
