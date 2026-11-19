import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isMtnNumber, normalizeRwandaPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/security/rate-limit";
import { isTerminal, startOrderPayment } from "@/lib/payments/service";
import { momoConfig } from "@/lib/payments/momo";

// Lets a customer retry MoMo after a failed / expired / declined prompt.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`pay-retry:${ip}`, 5, 60_000).ok) return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });

  const order = await db.order.findUnique({ where: { id: orderId }, include: { store: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!order || order.paymentMethod !== "MTN_MOMO") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.paymentStatus !== "UNPAID" || order.status !== "PENDING") return NextResponse.json({ error: "This order can no longer be paid." }, { status: 409 });
  const last = order.payments[0];
  if (last && !isTerminal(last.status)) return NextResponse.json({ error: "A payment request is already waiting for approval." }, { status: 409 });

  const { phone } = (await req.json().catch(() => ({}))) as { phone?: string };
  let msisdn = phone ? normalizeRwandaPhone(phone) : last?.payerPhone ?? order.customerPhone;
  if (phone && !msisdn && momoConfig()?.environment === "sandbox") msisdn = phone.replace(/\D/g, "");
  if (!msisdn || (momoConfig()?.environment === "production" && !isMtnNumber(msisdn))) {
    return NextResponse.json({ error: "Enter an MTN number (078 or 079)." }, { status: 400 });
  }
  const payment = await startOrderPayment(order, msisdn, order.store.name);
  return NextResponse.json({ ok: true, status: payment.status });
}
