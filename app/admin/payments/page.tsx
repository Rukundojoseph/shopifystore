import Link from "next/link";
import type { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader, Table, Td, Th, cn } from "@/components/ui";
import { PaymentStatusBadge } from "@/components/dashboard/status";
import { momoAvailable, momoConfig } from "@/lib/payments/momo";

export const metadata = { title: "Payments" };

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const valid = ["pending", "processing", "successful", "failed", "expired", "cancelled", "refunded"];
  const payments = await db.payment.findMany({
    where: status && valid.includes(status) ? { status: status as PaymentStatus } : {},
    orderBy: { createdAt: "desc" }, take: 200,
    include: { store: { select: { name: true } }, order: { select: { number: true } } },
  });
  const cfg = momoConfig();
  return (
    <>
      <PageHeader title="Payments" description={`MTN MoMo: ${momoAvailable().mode}${cfg ? ` · ${cfg.environment} · target ${cfg.targetEnvironment} · callback ${cfg.callbackUrl ? "set" : "not set"}` : " · credentials not configured"}`} />
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "failed", "expired", "processing", "successful"].map((s) => <Link key={s} href={s ? `?status=${s}` : "?"} className={cn("rounded-full border px-3 py-1 text-sm", (status ?? "") === s ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white")}>{s || "All"}</Link>)}
      </div>
      <Card>
        <Table>
          <thead><tr><Th>Date</Th><Th>Store</Th><Th>Kind</Th><Th>Provider</Th><Th>Reference</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap text-zinc-500">{p.createdAt.toLocaleString("en-RW", { dateStyle: "short", timeStyle: "short" })}</Td>
                <Td>{p.store.name}{p.order && <span className="text-zinc-500"> · #{p.order.number}</span>}</Td>
                <Td>{p.kind === "CUSTOMER_ORDER" ? "Order" : "Subscription"}</Td>
                <Td>{p.provider}</Td>
                <Td className="font-mono text-xs text-zinc-500">{p.referenceId.slice(0, 8)}…{p.financialTransactionId ? ` / ${p.financialTransactionId}` : ""}</Td>
                <Td><PaymentStatusBadge status={p.status} />{p.failureReason && <p className="max-w-[220px] truncate text-xs text-red-600">{p.failureReason}</p>}</Td>
                <Td className="text-right">{formatMoney(p.amount, p.currency)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
