/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { resolveStore } from "@/lib/tenants/resolve";
import { StorePage } from "@/components/storefront/store-page";
import { PaymentTracker } from "@/components/checkout/payment-tracker";
import { href } from "@/components/storefront/types";
import { formatMoney } from "@/lib/money";
import { formatRwandaPhone } from "@/lib/phone";
import { simulatorEnabled } from "@/lib/payments/momo";

type P = { params: Promise<{ store: string; id: string }> };

export const metadata = { title: "Order confirmation", robots: { index: false } };

export default async function OrderPage({ params }: P) {
  const { store: key, id } = await params;
  const store = await resolveStore(key);
  if (!store || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await db.order.findFirst({
    where: { id, storeId: store.id },
    include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) notFound();
  const payment = order.payments[0];

  return (
    <StorePage storeKey={key}>
      {({ ctx }) => (
        <div className="mx-auto max-w-2xl px-4 py-10 @2xl:py-16">
          <p className="text-sm opacity-60">Order #{order.number}</p>
          <h1 className="mt-1 text-3xl font-semibold" style={{ fontFamily: "var(--sf-heading)" }}>Thank you, {order.customerName.split(" ")[0]}!</h1>

          <div className="mt-6">
            <PaymentTracker
              orderId={order.id}
              method={order.paymentMethod}
              initial={{ paymentStatus: payment?.status ?? "pending", failureReason: payment?.failureReason ?? null, orderPaymentStatus: order.paymentStatus, orderStatus: order.status }}
              payerPhone={payment?.payerPhone ? formatRwandaPhone(payment.payerPhone) : null}
              simulator={simulatorEnabled() && payment?.provider === "mtn_momo_simulator"}
            />
          </div>

          <section className="mt-8 border border-current/10 p-6" style={{ borderRadius: "var(--sf-radius)" }}>
            <ul className="flex flex-col gap-3">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 text-sm">
                  <div className="h-14 w-14 shrink-0 overflow-hidden bg-black/5" style={{ borderRadius: "var(--sf-radius)" }}>{i.imageUrl && <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="flex-1"><p className="font-medium">{i.name}</p>{i.variantName && <p className="text-xs opacity-60">{i.variantName}</p>}<p className="text-xs opacity-60">Qty {i.quantity}</p></div>
                  <span>{formatMoney(i.total, order.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-6 flex flex-col gap-2 border-t border-current/10 pt-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotal, order.currency)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd>{order.deliveryFee ? formatMoney(order.deliveryFee, order.currency) : "Free"}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatMoney(order.total, order.currency)}</dd></div>
            </dl>
          </section>

          <section className="mt-6 grid gap-6 text-sm @2xl:grid-cols-2">
            <div><p className="mb-1 font-semibold">Delivery to</p><p className="opacity-80">{order.address}<br />{order.district}</p></div>
            <div><p className="mb-1 font-semibold">Contact</p><p className="opacity-80">{formatRwandaPhone(order.customerPhone)}{order.customerEmail && <><br />{order.customerEmail}</>}</p></div>
          </section>

          <p className="mt-8 text-sm opacity-70">Keep this page link to check your order. Questions? Contact {store.name}{store.phone ? ` on ${store.phone}` : ""}.</p>
          <Link href={href(ctx, "/products")} className="mt-6 inline-block text-sm font-semibold underline">Continue shopping</Link>
        </div>
      )}
    </StorePage>
  );
}
