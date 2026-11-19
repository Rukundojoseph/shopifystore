import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({ storeId: z.string().uuid(), email: z.string().email().max(200) });

// MVP: signups are recorded in the audit log (action newsletter.subscribe) and
// listed on the store's Customers page. Swap for a mailing-list integration later.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`newsletter:${ip}`, 5, 60_000).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  const store = await db.store.findUnique({ where: { id: parsed.data.storeId }, select: { id: true, status: true } });
  if (!store || store.status !== "PUBLISHED") return NextResponse.json({ error: "Not found" }, { status: 404 });
  await audit({ action: "newsletter.subscribe", storeId: store.id, metadata: { email: parsed.data.email.toLowerCase() } });
  return NextResponse.json({ ok: true });
}
