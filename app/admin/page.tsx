import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Platform analytics" };

export default async function AdminHome() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [users, stores, published, orders, paidAgg, monthAgg, failed, activeSubs, newStores] = await Promise.all([
    db.user.count(),
    db.store.count(),
    db.store.count({ where: { status: "PUBLISHED" } }),
    db.order.count(),
    db.payment.aggregate({ where: { kind: "CUSTOMER_ORDER", status: "successful" }, _sum: { amount: true }, _count: true }),
    db.payment.aggregate({ where: { kind: "CUSTOMER_ORDER", status: "successful", createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.payment.count({ where: { status: { in: ["failed", "expired"] }, createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
    db.subscription.findMany({ where: { status: { in: ["ACTIVE", "TRIALING"] } }, include: { plan: true } }),
    db.store.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { owner: { select: { name: true, email: true } } } }),
  ]);
  const mrr = activeSubs.filter((s) => s.status === "ACTIVE").reduce((n, s) => n + s.plan.priceMonthly, 0);
  const planCounts = activeSubs.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.plan.name]: (acc[s.plan.name] ?? 0) + 1 }), {});

  const stats = [
    ["Registered users", users.toLocaleString()],
    ["Active stores", stores.toLocaleString()],
    ["Published stores", published.toLocaleString()],
    ["Total orders", orders.toLocaleString()],
    ["Successful transactions", `${paidAgg._count} · ${formatMoney(paidAgg._sum.amount ?? 0)}`],
    ["GMV this month", formatMoney(monthAgg._sum.amount ?? 0)],
    ["Monthly recurring revenue", formatMoney(mrr)],
    ["Payment failures (7 days)", failed.toLocaleString()],
  ];

  return (
    <>
      <PageHeader title="Platform analytics" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value]) => <Card key={label} className="p-5"><p className="text-sm text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></Card>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title="Newest stores" />
          <Table>
            <thead><tr><Th>Store</Th><Th>Owner</Th><Th>Status</Th><Th>Created</Th></tr></thead>
            <tbody>{newStores.map((s) => <tr key={s.id}><Td className="font-medium">{s.name}<p className="text-xs text-zinc-500">{s.slug}</p></Td><Td>{s.owner.name}<p className="text-xs text-zinc-500">{s.owner.email}</p></Td><Td>{s.status}</Td><Td className="text-zinc-500">{s.createdAt.toLocaleDateString("en-RW")}</Td></tr>)}</tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Subscriptions by plan" />
          <ul className="divide-y divide-zinc-100 text-sm">{Object.entries(planCounts).map(([k, v]) => <li key={k} className="flex justify-between px-5 py-3"><span>{k}</span><span className="font-semibold">{v}</span></li>)}</ul>
        </Card>
      </div>
    </>
  );
}
