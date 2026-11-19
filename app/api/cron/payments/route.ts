import { NextResponse } from "next/server";
import { sweepPayments } from "@/lib/payments/service";

// Fallback for missing callbacks. Call every 2–5 minutes, e.g. Vercel Cron or
// GitHub Actions:  curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/payments
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sweepPayments());
}
