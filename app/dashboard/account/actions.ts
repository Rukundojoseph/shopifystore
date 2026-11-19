"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/ui/form-message";

export async function saveProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter your name" };
  await db.user.update({ where: { id: user.id }, data: { name: name.slice(0, 120), phone: String(form.get("phone") ?? "").trim().slice(0, 20) || null } });
  return { success: "Profile saved." };
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ current: z.string(), next: z.string().min(8, "Use at least 8 characters").max(200) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(parsed.data.current, record.passwordHash))) return { error: "Current password is incorrect." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  await audit({ action: "user.password_change", userId: user.id });
  return { success: "Password changed." };
}
