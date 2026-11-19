import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hmacVerify } from "@/lib/security/crypto";
import { refreshPayment } from "@/lib/payments/service";

// MTN posts (or puts) the final result here. The body is treated only as a
// trigger: the authoritative status is re-fetched from MTN's status endpoint
// before anything changes, so a forged callback cannot mark an order paid.
// The URL carries an HMAC of the reference id to reject junk early.
async function handle(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(ref) || !sig || !hmacVerify(ref, sig)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payment = await db.payment.findUnique({ where: { referenceId: ref } });
  if (!payment) return NextResponse.json({ ok: true }); // unknown reference: acknowledge, ignore

  const body = (await req.json().catch(() => null)) as Prisma.InputJsonValue | null;
  await db.paymentEvent.create({ data: { paymentId: payment.id, source: "callback", note: "Callback received", payload: body ?? undefined } });

  // Respond quickly; verification is idempotent so duplicates are harmless.
  await refreshPayment(payment.id, "callback");
  return NextResponse.json({ ok: true });
}

export const POST = handle;
export const PUT = handle;
