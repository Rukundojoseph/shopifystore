"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertStorePermission } from "@/lib/tenants";
import { refreshPayment, transition } from "@/lib/payments/service";
import { audit } from "@/lib/audit";
import { applyOrderStatus } from "@/lib/orders/status";

const FULFILMENT = ["PENDING", "PAID", "PROCESSING", "READY_FOR_DELIVERY", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export async function updateOrderStatusAction(form: FormData) {
  const { store, user } = await assertStorePermission("orders.update");
  const id = String(form.get("id"));
  const status = z.enum(FULFILMENT).parse(form.get("status"));
  const res = await applyOrderStatus(store.id, user.id, id, status);
  if (!res.ok) return;
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard/orders");
}

/** Cash on delivery: record that the cash was collected. */
export async function markCashCollectedAction(form: FormData) {
  const { store, user } = await assertStorePermission("orders.update");
  const id = String(form.get("id"));
  const payment = await db.payment.findFirst({ where: { orderId: id, storeId: store.id, provider: "cash", status: { in: ["pending", "processing"] } } });
  if (!payment) return;
  await transition(payment.id, "successful", "manual", { note: `Cash collected — recorded by ${user.name}` });
  await audit({ action: "order.cash_collected", userId: user.id, storeId: store.id, metadata: { orderId: id } });
  revalidatePath(`/dashboard/orders/${id}`);
}

export async function checkPaymentAction(form: FormData) {
  const { store } = await assertStorePermission("orders.view");
  const id = String(form.get("paymentId"));
  const payment = await db.payment.findFirst({ where: { id, storeId: store.id } });
  if (payment) await refreshPayment(payment.id, "poll");
  revalidatePath(`/dashboard/orders/${payment?.orderId}`);
}
