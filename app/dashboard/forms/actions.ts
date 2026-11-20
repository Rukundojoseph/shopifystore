"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertStorePermission } from "@/lib/tenants";
import { audit } from "@/lib/audit";

/** Deletes one submission (e.g. for a data deletion request). Scoped to the current store. */
export async function deleteSubmissionAction(form: FormData) {
  const { store, user } = await assertStorePermission("customers.view");
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const res = await db.formSubmission.deleteMany({ where: { id, storeId: store.id } });
  if (res.count) await audit({ action: "form.submission.delete", userId: user.id, storeId: store.id, metadata: { id } });
  revalidatePath("/dashboard/forms");
}
