import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshPayment } from "@/lib/payments/service";
import { rateLimit } from "@/lib/security/rate-limit";

// Polled by the order confirmation page. Looks up by order id (unguessable UUID)
// and only reveals payment status, never personal data.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`pay-status:${ip}`, 60, 60_000).ok) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latest = await db.payment.findFirst({ where: { orderId }, orderBy: { createdAt: "desc" } });
  if (!latest) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payment = await refreshPayment(latest.id, "poll");
  const order = await db.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true, status: true } });
  return NextResponse.json({
    paymentStatus: payment.status,
    failureReason: payment.failureReason,
    provider: payment.provider,
    orderPaymentStatus: order?.paymentStatus,
    orderStatus: order?.status,
  });
}
