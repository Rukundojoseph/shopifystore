import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function audit(entry: {
  action: string;
  userId?: string | null;
  storeId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}) {
  try {
    await db.auditLog.create({ data: { ...entry, userId: entry.userId ?? null, storeId: entry.storeId ?? null } });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
