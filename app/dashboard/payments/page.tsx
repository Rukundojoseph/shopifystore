import Link from "next/link";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { formatMoney } from "@/lib/money";
import { formatRwandaPhone } from "@/lib/phone";
import { momoAvailable } from "@/lib/payments/momo";
import { Alert, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { PaymentStatusBadge } from "@/components/dashboard/status";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const { store } = await requireStore("payments.view");
  const [payments, sums] = await Promise.all([
    db.payment.findMany({ where: { storeId: store.id, kind: "CUSTOMER_ORDER" }, orderBy: { createdAt: "desc" }, take: 100, include: { order: { select: { number: true, id: true } } } }),
    db.payment.groupBy({ by: ["status"], where: { storeId: store.id, kind: "CUSTOMER_ORDER" }, _sum: { amount: true }, _count: true }),
  ]);
  const get = (s: string) => sums.find((x) => x.status === s);
  const mode = momoAvailable().mode;

  return (
    <>
      <PageHeader title="Payments" description="Every payment attempt, including failed and expired MoMo requests." />
      {mode !== "live" && (
        <div className="mb-4">
          <Alert tone={mode === "simulator" ? "info" : "warning"}>
            {mode === "simulator" ? "MTN MoMo is running in dev simulator mode — no real money moves." : "MTN MoMo is not configured on this platform yet, so customers can only pay on delivery."}
          </Alert>
        </div>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[["successful", "Received"], ["processing", "Awaiting approval"], ["failed", "Failed"]].map(([s, label]) => (
          <Card key={s} className="p-5">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(get(s)?._sum.amount ?? 0, store.currency)}</p>
            <p className="text-xs text-zinc-500">{get(s)?._count ?? 0} payments</p>
          </Card>
        ))}
      </div>
      <Card>
        {payments.length ? (
          <Table>
            <thead><tr><Th>Date</Th><Th>Order</Th><Th>Method</Th><Th>Payer</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td className="whitespace-nowrap text-zinc-500">{p.createdAt.toLocaleString("en-RW", { dateStyle: "medium", timeStyle: "short" })}</Td>
                  <Td>{p.order ? <Link className="text-brand-700" href={`/dashboard/orders/${p.order.id}`}>#{p.order.number}</Link> : "—"}</Td>
                  <Td>{p.provider === "cash" ? "On delivery" : p.provider === "mtn_momo_simulator" ? "MoMo (simulated)" : "MTN MoMo"}</Td>
                  <Td>{p.payerPhone ? formatRwandaPhone(p.payerPhone) : "—"}</Td>
                  <Td><PaymentStatusBadge status={p.status} />{p.failureReason && <p className="mt-0.5 max-w-[200px] truncate text-xs text-red-600" title={p.failureReason}>{p.failureReason}</p>}</Td>
                  <Td className="text-right font-medium">{formatMoney(p.amount, p.currency)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No payments yet" />
        )}
      </Card>
    </>
  );
}
