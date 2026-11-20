import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  storeId: z.string().uuid(),
  form: z.string().trim().min(1).max(80),
  path: z.string().max(300).optional(),
  fields: z.record(z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), z.string().max(2000)).refine((f) => Object.keys(f).length <= 30, "Too many fields"),
  /** Honeypot: humans never see this field. */
  _hp: z.string().max(200).optional(),
});

/** Saves a submission from a form built in the website editor (Dashboard → Form submissions). */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`form:${ip}`, 10, 60_000).ok) return NextResponse.json({ error: "Too many submissions. Please wait a minute." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const { storeId, form, path, fields, _hp } = parsed.data;
  if (_hp) return NextResponse.json({ ok: true }); // bot: pretend success, store nothing
  if (!rateLimit(`form:${storeId}`, 120, 60_000).ok) return NextResponse.json({ error: "Too many submissions" }, { status: 429 });

  const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true, status: true } });
  if (!store || store.status === "SUSPENDED") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (store.status !== "PUBLISHED") {
    // Draft stores: only members testing their own preview can submit.
    const user = await getCurrentUser();
    const member = user && (await db.storeMember.findFirst({ where: { storeId, userId: user.id }, select: { id: true } }));
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const clean = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  await db.formSubmission.create({ data: { storeId, formName: form, data: clean as Prisma.InputJsonValue, pagePath: path?.slice(0, 300) } });
  return NextResponse.json({ ok: true });
}
