"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertStorePermission } from "@/lib/tenants";
import { audit } from "@/lib/audit";

/**
 * Right-to-erasure (Rwanda Law No. 058/2021): removes the customer's personal
 * data and anonymises their orders while keeping amounts for accounting.
 */
export async function eraseCustomerAction(form: FormData) {
  const { store, user } = await assertStorePermission("store.settings");
  const id = String(form.get("id"));
  const customer = await db.customer.findFirst({ where: { id, storeId: store.id } });
  if (!customer) return;
  await db.$transaction([
    db.order.updateMany({ where: { storeId: store.id, customerId: id }, data: { customerName: "Erased customer", customerPhone: "000000000000", customerEmail: null, address: "—", notes: null } }),
    db.payment.updateMany({ where: { storeId: store.id, order: { customerId: id } }, data: { payerPhone: null } }),
    db.customer.delete({ where: { id } }),
  ]);
  await audit({ action: "customer.erase", userId: user.id, storeId: store.id, metadata: { customerId: id } });
  revalidatePath("/dashboard/customers");
}
