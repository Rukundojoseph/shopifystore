"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertStorePermission } from "@/lib/tenants";
import { audit } from "@/lib/audit";

// MVP: subscription payments are handled manually. The owner requests a plan,
// a platform admin confirms payment and activates it from /admin/stores.
export async function requestPlanAction(form: FormData) {
  const { store, user } = await assertStorePermission("billing.manage");
  const plan = await db.subscriptionPlan.findUnique({ where: { key: String(form.get("plan")) } });
  if (!plan || !plan.isActive) return;
  await audit({ action: "subscription.request", userId: user.id, storeId: store.id, metadata: { plan: plan.key } });
  revalidatePath("/dashboard/billing");
}
