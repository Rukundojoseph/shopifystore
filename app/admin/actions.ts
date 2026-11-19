"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export async function setUserStatusAction(form: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(form.get("id"));
  if (id === admin.id) return;
  const status = form.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  await db.user.update({ where: { id }, data: { status } });
  await audit({ action: `admin.user.${status.toLowerCase()}`, userId: admin.id, metadata: { target: id } });
  revalidatePath("/admin/users");
}

export async function setUserRoleAction(form: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(form.get("id"));
  if (id === admin.id) return;
  const role = form.get("role") === "PLATFORM_ADMIN" ? "PLATFORM_ADMIN" : "USER";
  await db.user.update({ where: { id }, data: { role } });
  await audit({ action: "admin.user.role", userId: admin.id, metadata: { target: id, role } });
  revalidatePath("/admin/users");
}

export async function setStoreStatusAction(form: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(form.get("id"));
  const target = String(form.get("status"));
  const store = await db.store.findUniqueOrThrow({ where: { id } });
  const status = target === "SUSPENDED" ? "SUSPENDED" : store.publishedConfig ? "PUBLISHED" : "DRAFT";
  await db.store.update({ where: { id }, data: { status } });
  await audit({ action: `admin.store.${target === "SUSPENDED" ? "suspend" : "restore"}`, userId: admin.id, storeId: id });
  revalidatePath("/admin/stores");
}

export async function verifyDomainAction(form: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(form.get("id"));
  const verify = form.get("verify") === "1";
  const d = await db.storeDomain.update({ where: { id }, data: { verifiedAt: verify ? new Date() : null } });
  await audit({ action: verify ? "admin.domain.verify" : "admin.domain.unverify", userId: admin.id, storeId: d.storeId, metadata: { domain: d.domain } });
  revalidatePath("/admin/stores");
}

export async function setStorePlanAction(form: FormData) {
  const admin = await requirePlatformAdmin();
  const storeId = String(form.get("storeId"));
  const plan = await db.subscriptionPlan.findUniqueOrThrow({ where: { key: String(form.get("plan")) } });
  const months = Math.max(0, Math.min(24, Number(form.get("months") || 1)));
  const trial = form.get("trial") === "on";
  await db.$transaction([
    db.subscription.updateMany({ where: { storeId, status: { in: ["ACTIVE", "TRIALING"] } }, data: { status: "CANCELLED" } }),
    db.subscription.create({
      data: {
        storeId, planId: plan.id, status: trial ? "TRIALING" : "ACTIVE",
        trialEndsAt: trial ? new Date(Date.now() + 14 * 86400_000) : null,
        currentPeriodEnd: plan.priceMonthly > 0 ? new Date(Date.now() + (trial ? 14 : months * 30) * 86400_000) : null,
      },
    }),
  ]);
  await audit({ action: "admin.subscription.set", userId: admin.id, storeId, metadata: { plan: plan.key, months, trial } });
  revalidatePath("/admin/stores");
}

export async function savePlanAction(form: FormData) {
  const admin = await requirePlatformAdmin();
  const d = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(60),
    description: z.string().max(300),
    priceMonthly: z.coerce.number().int().min(0),
    maxProducts: z.string(),
    features: z.string().max(3000),
  }).parse(Object.fromEntries(form));
  await db.subscriptionPlan.update({
    where: { id: d.id },
    data: {
      name: d.name, description: d.description, priceMonthly: d.priceMonthly,
      maxProducts: d.maxProducts.trim() === "" ? null : Math.max(1, Number(d.maxProducts)),
      allowMomo: form.get("allowMomo") === "on", allowCustomDomain: form.get("allowCustomDomain") === "on",
      allTemplates: form.get("allTemplates") === "on", isActive: form.get("isActive") === "on",
      features: d.features.split("\n").map((s) => s.trim()).filter(Boolean),
    },
  });
  await audit({ action: "admin.plan.update", userId: admin.id, metadata: { planId: d.id } });
  revalidatePath("/admin/plans");
}
