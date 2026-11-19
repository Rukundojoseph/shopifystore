import "server-only";
import { randomUUID } from "node:crypto";
import type { Payment, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hmacSign } from "@/lib/security/crypto";
import { getRequestToPayStatus, mapRemoteStatus, momoConfig, MomoError, reasonText, requestToPay, simulatorEnabled } from "./momo";

// Centralised payment service. Every status change goes through `transition`,
// which is atomic and idempotent: duplicate callbacks or concurrent polls can
// never apply the same outcome twice.

type Tx = Prisma.TransactionClient;

const TERMINAL: PaymentStatus[] = ["successful", "failed", "expired", "cancelled", "refunded"];
const ALLOWED_FROM: Record<PaymentStatus, PaymentStatus[]> = {
  pending: [],
  processing: ["pending"],
  successful: ["pending", "processing"],
  failed: ["pending", "processing"],
  expired: ["pending", "processing"],
  cancelled: ["pending", "processing"],
  refunded: ["successful"],
};

export const isTerminal = (s: PaymentStatus) => TERMINAL.includes(s);

/** Payments still waiting this long are asked about, then expired. */
const EXPIRE_AFTER_MS = 30 * 60_000;
/** Unpaid MoMo orders are cancelled (and stock released) after this. */
const CANCEL_UNPAID_ORDER_AFTER_MS = 2 * 60 * 60_000;

export function callbackUrlFor(referenceId: string): string | null {
  const base = momoConfig()?.callbackUrl;
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set("ref", referenceId);
  u.searchParams.set("sig", hmacSign(referenceId));
  return u.toString();
}

export async function transition(
  paymentId: string,
  to: PaymentStatus,
  source: string,
  extra: { note?: string; payload?: Prisma.InputJsonValue; financialTransactionId?: string; failureReason?: string | null } = {},
): Promise<{ changed: boolean; payment: Payment }> {
  return db.$transaction(async (tx) => {
    const before = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: ALLOWED_FROM[to] } },
      data: {
        status: to,
        ...(extra.financialTransactionId ? { financialTransactionId: extra.financialTransactionId } : {}),
        ...(extra.failureReason !== undefined ? { failureReason: extra.failureReason } : {}),
      },
    });

    if (count === 0) {
      // Already moved on (duplicate callback, race with poller, etc.). Record and ignore.
      await tx.paymentEvent.create({
        data: { paymentId, source, fromStatus: before.status, toStatus: before.status, note: `Ignored transition to ${to}: payment is ${before.status}`, payload: extra.payload },
      });
      return { changed: false, payment: before };
    }

    await tx.paymentEvent.create({ data: { paymentId, source, fromStatus: before.status, toStatus: to, note: extra.note, payload: extra.payload } });
    if (before.orderId) await applyToOrder(tx, before.orderId, to);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    return { changed: true, payment };
  });
}

async function applyToOrder(tx: Tx, orderId: string, status: PaymentStatus) {
  if (status === "successful") {
    // Only mark paid once; status advances to PAID only if still PENDING.
    await tx.order.updateMany({ where: { id: orderId, paymentStatus: "UNPAID" }, data: { paymentStatus: "PAID" } });
    await tx.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "PAID" } });
  } else if (status === "refunded") {
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "REFUNDED" } });
  }
  // failed / expired / cancelled: the order stays PENDING so the customer can retry;
  // the sweeper cancels it and releases stock if it is never paid.
}

export async function releaseOrderStock(tx: Tx, orderId: string) {
  const { count } = await tx.order.updateMany({ where: { id: orderId, stockReleased: false }, data: { stockReleased: true } });
  if (!count) return;
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (item.variantId) await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stockQuantity: { increment: item.quantity } } });
    else if (item.productId) await tx.product.updateMany({ where: { id: item.productId, trackInventory: true }, data: { stockQuantity: { increment: item.quantity } } });
  }
}

/** Creates a payment record for an order and, for MoMo, sends the Request to Pay. */
export async function startOrderPayment(order: { id: string; storeId: string; number: number; total: number; currency: string; paymentMethod: string }, payerMsisdn: string | null, storeName: string) {
  const referenceId = randomUUID();

  if (order.paymentMethod === "CASH_ON_DELIVERY") {
    return db.payment.create({
      data: {
        storeId: order.storeId, orderId: order.id, kind: "CUSTOMER_ORDER", provider: "cash", referenceId, externalId: order.id,
        amount: order.total, currency: order.currency, payerPhone: payerMsisdn, status: "pending",
        events: { create: { source: "system", toStatus: "pending", note: "Cash on delivery — collect payment on delivery" } },
      },
    });
  }

  const live = !!momoConfig();
  const payment = await db.payment.create({
    data: {
      storeId: order.storeId, orderId: order.id, kind: "CUSTOMER_ORDER", provider: live ? "mtn_momo" : "mtn_momo_simulator",
      referenceId, externalId: "", amount: order.total, currency: live ? momoConfig()!.currency : order.currency,
      payerPhone: payerMsisdn, status: "pending",
      events: { create: { source: "request", toStatus: "pending", note: "Payment request created" } },
    },
  });
  await db.payment.update({ where: { id: payment.id }, data: { externalId: payment.id } });

  if (live) {
    try {
      await requestToPay({
        referenceId,
        externalId: payment.id,
        amount: order.total,
        payerMsisdn: payerMsisdn!,
        payerMessage: `${storeName} order #${order.number}`,
        payeeNote: `Order #${order.number}`,
        callbackUrl: callbackUrlFor(referenceId),
      });
      await transition(payment.id, "processing", "request", { note: "MTN accepted the request (202). Awaiting customer approval." });
    } catch (e) {
      const msg = e instanceof MomoError ? e.message : "Could not reach MTN MoMo";
      await transition(payment.id, "failed", "request", { note: msg, failureReason: msg, payload: (e instanceof MomoError ? (e.body as Prisma.InputJsonValue) : undefined) ?? undefined });
    }
  } else if (simulatorEnabled()) {
    await transition(payment.id, "processing", "simulator", { note: "Simulator: awaiting manual approval (no real money)" });
  } else {
    await transition(payment.id, "failed", "system", { note: "MTN MoMo is not configured", failureReason: "Mobile Money is temporarily unavailable" });
  }
  return db.payment.findUniqueOrThrow({ where: { id: payment.id } });
}

/** Asks MTN for the final status. Safe to call repeatedly (throttled to one check / 5 s). */
export async function refreshPayment(paymentId: string, source: "poll" | "callback" | "sweep" = "poll"): Promise<Payment> {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (isTerminal(payment.status) || payment.provider !== "mtn_momo" || !momoConfig()) return maybeExpire(payment);
  if (source === "poll" && payment.lastCheckedAt && Date.now() - payment.lastCheckedAt.getTime() < 5000) return payment;

  await db.payment.update({ where: { id: paymentId }, data: { lastCheckedAt: new Date() } });
  try {
    const remote = await getRequestToPayStatus(payment.referenceId);
    if (!remote) return maybeExpire(payment);
    const mapped = mapRemoteStatus(remote);
    if (mapped === "processing") return maybeExpire(payment);
    // Guard against amount tampering / mismatched records.
    if (mapped === "successful" && remote.amount && Number(remote.amount) !== payment.amount) {
      return (await transition(paymentId, "failed", source, { note: `Amount mismatch: MTN reported ${remote.amount}`, payload: remote as Prisma.InputJsonValue, failureReason: "Amount mismatch" })).payment;
    }
    return (
      await transition(paymentId, mapped, source, {
        payload: remote as Prisma.InputJsonValue,
        financialTransactionId: remote.financialTransactionId,
        failureReason: mapped === "successful" ? null : reasonText(remote),
      })
    ).payment;
  } catch (e) {
    console.error("[payments] status check failed", paymentId, e);
    return payment;
  }
}

async function maybeExpire(payment: Payment): Promise<Payment> {
  if (isTerminal(payment.status) || payment.provider === "cash") return payment;
  if (Date.now() - payment.createdAt.getTime() < EXPIRE_AFTER_MS) return payment;
  return (await transition(payment.id, "expired", "system", { note: "No final status from MTN within 30 minutes", failureReason: "Payment request expired" })).payment;
}

/** Dev-only: approve or decline a simulated payment. */
export async function simulateDecision(paymentId: string, approve: boolean) {
  if (!simulatorEnabled()) throw new Error("Simulator disabled");
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.provider !== "mtn_momo_simulator") throw new Error("Not a simulated payment");
  return transition(paymentId, approve ? "successful" : "failed", "simulator", {
    note: approve ? "Simulator: approved" : "Simulator: declined",
    financialTransactionId: approve ? `SIM-${Date.now()}` : undefined,
    failureReason: approve ? null : "Customer declined (simulated)",
  });
}

/** Background sweep: re-check in-flight payments and cancel abandoned unpaid orders. Run every few minutes. */
export async function sweepPayments() {
  const inflight = await db.payment.findMany({ where: { status: { in: ["pending", "processing"] }, provider: { not: "cash" } }, take: 100, orderBy: { createdAt: "asc" } });
  for (const p of inflight) await refreshPayment(p.id, "sweep");

  const cutoff = new Date(Date.now() - CANCEL_UNPAID_ORDER_AFTER_MS);
  const abandoned = await db.order.findMany({
    where: { paymentMethod: "MTN_MOMO", paymentStatus: "UNPAID", status: "PENDING", createdAt: { lt: cutoff }, payments: { none: { status: { in: ["pending", "processing", "successful"] } } } },
    select: { id: true },
    take: 100,
  });
  for (const o of abandoned) {
    await db.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({ where: { id: o.id, status: "PENDING", paymentStatus: "UNPAID" }, data: { status: "CANCELLED" } });
      if (count) await releaseOrderStock(tx, o.id);
    });
  }
  return { checked: inflight.length, cancelledOrders: abandoned.length };
}
