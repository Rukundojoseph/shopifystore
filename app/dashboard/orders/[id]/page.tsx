/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { can } from "@/lib/tenants/permissions";
import { formatMoney } from "@/lib/money";
import { formatRwandaPhone } from "@/lib/phone";
import { Alert, Button, Card, CardHeader, PageHeader, Select } from "@/components/ui";
import { ORDER_STATUS_LABEL, OrderPaymentBadge, OrderStatusBadge, PaymentStatusBadge } from "@/components/dashboard/status";
import { PrintButton } from "@/components/dashboard/print-button";
import { checkPaymentAction, markCashCollectedAction, updateOrderStatusAction } from "../actions";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { store, role } = await requireStore("orders.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await db.order.findFirst({
    where: { id, storeId: store.id },
    include: { items: true, customer: { include: { _count: { select: { orders: true } } } }, payments: { orderBy: { createdAt: "desc" }, include: { events: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!order) notFound();
  const canUpdate = can(role, "orders.update");
  const cashPending = order.payments.find((p) => p.provider === "cash" && (p.status === "pending" || p.status === "processing"));
  const wa = order.customerPhone.replace(/\D/g, "");

  return (
    <>
      <Link href="/dashboard/orders" className="no-print text-sm text-zinc-500 hover:text-zinc-900">← Orders</Link>
      <PageHeader
        title={`Order #${order.number}`}
        description={order.createdAt.toLocaleString("en-RW", { dateStyle: "full", timeStyle: "short" })}
        actions={<div className="no-print flex gap-2"><PrintButton /></div>}
      />
      {order.paymentMethod === "MTN_MOMO" && order.paymentStatus !== "PAID" && order.status !== "CANCELLED" && (
        <div className="no-print mb-4"><Alert tone="warning">Payment has not been confirmed yet. Don&apos;t dispatch until it shows as <b>Paid</b>.</Alert></div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Items" action={<div className="flex gap-2"><OrderPaymentBadge status={order.paymentStatus} /><OrderStatusBadge status={order.status} /></div>} />
            <ul className="divide-y divide-zinc-100">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-100">{i.imageUrl && <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="flex-1"><p className="font-medium">{i.name}</p>{i.variantName && <p className="text-xs text-zinc-500">{i.variantName}</p>}</div>
                  <span className="text-zinc-500">{formatMoney(i.unitPrice, order.currency)} × {i.quantity}</span>
                  <span className="w-28 text-right font-medium">{formatMoney(i.total, order.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-1 border-t border-zinc-100 px-5 py-4 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">Subtotal</dt><dd>{formatMoney(order.subtotal, order.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Delivery</dt><dd>{order.deliveryFee ? formatMoney(order.deliveryFee, order.currency) : "Free"}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatMoney(order.total, order.currency)}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Payment" description={order.paymentMethod === "MTN_MOMO" ? "MTN Mobile Money" : "Pay on delivery"} />
            <div className="divide-y divide-zinc-100">
              {order.payments.map((p) => (
                <div key={p.id} className="px-5 py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <PaymentStatusBadge status={p.status} />
                    <span className="font-medium">{formatMoney(p.amount, p.currency)}</span>
                    {p.payerPhone && <span className="text-zinc-500">from {formatRwandaPhone(p.payerPhone)}</span>}
                    {p.financialTransactionId && <span className="text-xs text-zinc-500">MTN ref {p.financialTransactionId}</span>}
                    {p.provider === "mtn_momo_simulator" && <span className="text-xs font-medium text-amber-700">Simulated</span>}
                    {(p.status === "pending" || p.status === "processing") && p.provider !== "cash" && (
                      <form action={checkPaymentAction} className="no-print ml-auto"><input type="hidden" name="paymentId" value={p.id} /><Button size="sm" variant="outline">Check status</Button></form>
                    )}
                  </div>
                  {p.failureReason && <p className="mt-1 text-red-600">{p.failureReason}</p>}
                  <details className="no-print mt-2">
                    <summary className="cursor-pointer text-xs text-zinc-500">History ({p.events.length})</summary>
                    <ol className="mt-2 flex flex-col gap-1 border-l border-zinc-200 pl-3 text-xs text-zinc-600">
                      {p.events.map((e) => (
                        <li key={e.id}><span className="text-zinc-400">{e.createdAt.toLocaleTimeString("en-RW")}</span> · {e.source}{e.toStatus && e.fromStatus !== e.toStatus ? ` → ${e.toStatus}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
                      ))}
                    </ol>
                  </details>
                </div>
              ))}
            </div>
            {cashPending && canUpdate && (
              <form action={markCashCollectedAction} className="no-print border-t border-zinc-100 px-5 py-4">
                <input type="hidden" name="id" value={order.id} />
                <Button size="sm">Mark cash as collected</Button>
              </form>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {canUpdate && order.status !== "CANCELLED" && (
            <Card className="no-print p-5">
              <p className="mb-3 font-semibold">Fulfilment</p>
              <form action={updateOrderStatusAction} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={order.id} />
                <Select name="status" defaultValue={order.status}>
                  {Object.entries(ORDER_STATUS_LABEL).filter(([k]) => k !== "PAID" || order.paymentStatus === "PAID").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                <Button>Update status</Button>
                <p className="text-xs text-zinc-500">Cancelling returns items to stock.</p>
              </form>
            </Card>
          )}
          <Card className="p-5 text-sm">
            <p className="mb-2 font-semibold">Customer</p>
            <p>{order.customerName}</p>
            <a href={`tel:+${order.customerPhone}`} className="text-brand-700">{formatRwandaPhone(order.customerPhone)}</a>
            {order.customerEmail && <p className="text-zinc-600">{order.customerEmail}</p>}
            {order.customer && <p className="mt-1 text-xs text-zinc-500">{order.customer._count.orders} orders with you</p>}
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello ${order.customerName}, about your ${store.name} order #${order.number}`)}`} target="_blank" rel="noreferrer" className="no-print mt-2 inline-block text-xs font-medium text-green-700">Message on WhatsApp →</a>
            <p className="mb-2 mt-5 font-semibold">Delivery</p>
            <p className="whitespace-pre-line text-zinc-700">{order.address}</p>
            <p className="text-zinc-700">{order.district}</p>
            {order.notes && <><p className="mb-1 mt-5 font-semibold">Notes</p><p className="whitespace-pre-line text-zinc-700">{order.notes}</p></>}
          </Card>
        </div>
      </div>
    </>
  );
}
