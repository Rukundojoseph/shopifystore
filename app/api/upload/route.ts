import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { requireStore } from "@/lib/tenants";
import { can } from "@/lib/tenants/permissions";
import { MAX_UPLOAD_BYTES, storeImage } from "@/lib/storage";
import { rateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { store, role } = await requireStore();
  if (!can(role, "products.manage") && !can(role, "store.design")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!rateLimit(`upload:${user.id}`, 60, 60_000).ok) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Images must be 5 MB or smaller" }, { status: 413 });

  try {
    const { url, mime } = await storeImage(store.id, Buffer.from(await file.arrayBuffer()));
    await db.media.create({ data: { storeId: store.id, url, filename: file.name.slice(0, 200), mimeType: mime, size: file.size } });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
