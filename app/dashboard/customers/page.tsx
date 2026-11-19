import Link from "next/link";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { formatMoney } from "@/lib/money";
import { formatRwandaPhone } from "@/lib/phone";
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Table, Td, Th } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { eraseCustomerAction } from "./actions";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { store } = await requireStore("customers.view");
  const { q } = await searchParams;
  const customers = await db.customer.findMany({
    where: { storeId: store.id, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }, { email: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { orders: { where: { paymentStatus: "PAID" }, select: { total: true } }, _count: { select: { orders: true } } },
  });
  const subscribers = await db.auditLog.findMany({ where: { storeId: store.id, action: "newsletter.subscribe" }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <>
      <PageHeader title="Customers" description="Customers are created automatically when they check out." />
      <Card className="mb-6">
        <form className="flex gap-2 border-b border-zinc-100 p-4"><Input name="q" defaultValue={q} placeholder="Search name, phone or email" className="max-w-md" /><Button variant="outline">Search</Button></form>
        {customers.length ? (
          <Table>
            <thead><tr><Th>Name</Th><Th>Phone</Th><Th>Email</Th><Th>Orders</Th><Th>Total paid</Th><Th></Th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <Td className="font-medium">{c.name}</Td>
                  <Td>{formatRwandaPhone(c.phone)}</Td>
                  <Td className="text-zinc-600">{c.email ?? "—"}</Td>
                  <Td><Link className="text-brand-700" href={`/dashboard/orders?q=${c.phone}`}>{c._count.orders}</Link></Td>
                  <Td>{formatMoney(c.orders.reduce((n, o) => n + o.total, 0), store.currency)}</Td>
                  <Td>
                    <form action={eraseCustomerAction}><input type="hidden" name="id" value={c.id} />
                      <ConfirmButton message="Erase this customer's personal data? Their orders are kept but anonymised. Use this for data deletion requests." size="sm" variant="ghost" className="text-red-600">Erase data</ConfirmButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No customers yet" />
        )}
      </Card>
      <Card>
        <CardHeader title="Newsletter subscribers" description={`${subscribers.length} sign-ups from your website`} />
        {subscribers.length ? (
          <ul className="divide-y divide-zinc-100 text-sm">{subscribers.map((s) => <li key={s.id} className="flex justify-between px-5 py-2.5"><span>{(s.metadata as { email?: string })?.email}</span><span className="text-zinc-500">{s.createdAt.toLocaleDateString("en-RW")}</span></li>)}</ul>
        ) : (
          <EmptyState title="No subscribers yet" description="Add a Newsletter section to your website to collect emails." />
        )}
      </Card>
    </>
  );
}
