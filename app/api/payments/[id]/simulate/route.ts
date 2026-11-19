import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { simulateDecision } from "@/lib/payments/service";
import { simulatorEnabled } from "@/lib/payments/momo";

// DEV ONLY — stands in for the customer approving the prompt on their phone.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!simulatorEnabled()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { id: orderId } = await params;
  const { approve } = (await req.json().catch(() => ({}))) as { approve?: boolean };
  const payment = await db.payment.findFirst({ where: { orderId, provider: "mtn_momo_simulator" }, orderBy: { createdAt: "desc" } });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { changed } = await simulateDecision(payment.id, approve === true);
  return NextResponse.json({ ok: true, changed });
}
