import "server-only";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { releaseOrderStock } from "@/lib/payments/service";
import { audit } from "@/lib/audit";

/**
 * Changes an order's fulfilment status (shared by the dashboard and staff
 * workflows). Cancelling releases reserved stock and closes open payment
 * requests. "Paid" is never set here — only payment confirmation sets it.
 */
export async function applyOrderStatus(storeId: string, userId: string, orderId: string, status: OrderStatus): Promise<{ ok: boolean; error?: string }> {
  const order = await db.order.findFirst({ where: { id: orderId, storeId } });
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status === "CANCELLED") return { ok: false, error: "This order is already cancelled" };
  if (status === "PAID" && order.paymentStatus !== "PAID") return { ok: false, error: "Paid is set by payment confirmation" };
  await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status } });
    if (status === "CANCELLED") {
      await releaseOrderStock(tx, orderId);
      await tx.payment.updateMany({ where: { orderId, status: { in: ["pending", "processing"] } }, data: { status: "cancelled", failureReason: "Order cancelled by store" } });
    }
  });
  await audit({ action: "order.status", userId, storeId, metadata: { orderId, from: order.status, to: status } });
  return { ok: true };
}

/**
 * Permanently deletes an order. Refused for paid orders (keep financial
 * records); stock is released first if it was still reserved. Payment rows
 * are kept (their order link is cleared by the FK rule).
 */
export async function deleteOrder(storeId: string, userId: string, orderId: string): Promise<{ ok: boolean; error?: string }> {
  const order = await db.order.findFirst({ where: { id: orderId, storeId } });
  if (!order) return { ok: false, error: "Order not found" };
  if (order.paymentStatus === "PAID") return { ok: false, error: "Paid orders can't be deleted — cancel or refund instead" };
  await db.$transaction(async (tx) => {
    if (order.status !== "CANCELLED") await releaseOrderStock(tx, orderId);
    await tx.order.delete({ where: { id: orderId } });
  });
  await audit({ action: "order.delete", userId, storeId, metadata: { orderId, number: order.number } });
  return { ok: true };
}
