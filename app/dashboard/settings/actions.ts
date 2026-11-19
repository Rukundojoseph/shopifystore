"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertStorePermission } from "@/lib/tenants";
import { normalizeRwandaPhone } from "@/lib/phone";
import { getStorePlan } from "@/lib/plans";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/ui/form-message";

export async function saveStoreDetailsAction(_: FormState, form: FormData): Promise<FormState> {
  const { store, user } = await assertStorePermission("store.settings");
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      businessName: z.string().trim().min(2).max(120),
      description: z.string().trim().max(500),
      phone: z.string().trim(),
      email: z.string().trim().email(),
      location: z.string().trim().min(2).max(200),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const phone = normalizeRwandaPhone(parsed.data.phone);
  if (!phone) return { error: "Enter a Rwandan mobile number, e.g. 078 123 4567" };
  await db.store.update({ where: { id: store.id }, data: { ...parsed.data, phone: `+${phone}` } });
  await audit({ action: "store.update", userId: user.id, storeId: store.id });
  revalidatePath("/dashboard", "layout");
  return { success: "Store details saved." };
}

export async function saveCommerceSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  const { store, user } = await assertStorePermission("store.settings");
  const deliveryFee = Math.max(0, Math.round(Number(form.get("deliveryFee") || 0)));
  const freeRaw = String(form.get("freeDeliveryOver") ?? "").trim();
  const freeDeliveryOver = freeRaw === "" ? null : Math.max(0, Math.round(Number(freeRaw)));
  const acceptMomo = form.get("acceptMomo") === "on";
  const acceptCashOnDelivery = form.get("acceptCashOnDelivery") === "on";
  if (!Number.isFinite(deliveryFee) || (freeDeliveryOver !== null && !Number.isFinite(freeDeliveryOver))) return { error: "Enter amounts as whole RWF" };
  if (!acceptMomo && !acceptCashOnDelivery) return { error: "Enable at least one payment method so customers can order." };
  if (acceptMomo) {
    const { plan } = await getStorePlan(store.id);
    if (!plan?.allowMomo) return { error: `MTN MoMo checkout is available on the Business plan and above. Your plan: ${plan?.name ?? "Starter"}.` };
  }
  await db.storeSettings.upsert({
    where: { storeId: store.id },
    create: { storeId: store.id, deliveryFee, freeDeliveryOver, acceptMomo, acceptCashOnDelivery },
    update: { deliveryFee, freeDeliveryOver, acceptMomo, acceptCashOnDelivery },
  });
  await audit({ action: "store.commerce_settings", userId: user.id, storeId: store.id, metadata: { deliveryFee, freeDeliveryOver, acceptMomo, acceptCashOnDelivery } });
  revalidatePath("/dashboard/settings");
  return { success: "Delivery and payment settings saved." };
}

const domainRe = /^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

export async function addDomainAction(_: FormState, form: FormData): Promise<FormState> {
  const { store, user } = await assertStorePermission("store.settings");
  const domain = String(form.get("domain") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!domainRe.test(domain)) return { error: "Enter a domain like mystore.rw" };
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").split(":")[0];
  if (domain === root || domain.endsWith(`.${root}`)) return { error: "Use your own domain, not a platform subdomain." };
  const { plan } = await getStorePlan(store.id);
  if (!plan?.allowCustomDomain) return { error: "Custom domains are available on the Business plan and above." };
  if (await db.storeDomain.findUnique({ where: { domain } })) return { error: "This domain is already connected to a store." };
  await db.storeDomain.create({ data: { storeId: store.id, domain, type: "CUSTOM" } });
  await audit({ action: "domain.add", userId: user.id, storeId: store.id, metadata: { domain } });
  revalidatePath("/dashboard/settings");
  return { success: "Domain added. Point its DNS at the platform, then a platform admin will verify it." };
}

export async function removeDomainAction(form: FormData) {
  const { store, user } = await assertStorePermission("store.settings");
  const id = String(form.get("id"));
  const { count } = await db.storeDomain.deleteMany({ where: { id, storeId: store.id, type: "CUSTOM" } });
  if (count) await audit({ action: "domain.remove", userId: user.id, storeId: store.id, metadata: { id } });
  revalidatePath("/dashboard/settings");
}
