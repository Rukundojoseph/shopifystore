"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertStorePermission } from "@/lib/tenants";
import { slugify } from "@/lib/slug";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  imageUrl: z.string().max(1000).refine((u) => !u || u.startsWith("/uploads/") || u.startsWith("https://")).optional(),
});

export async function saveCategoryAction(input: z.input<typeof schema>): Promise<{ error?: string }> {
  const { store } = await assertStorePermission("products.manage");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Enter a category name" };
  const { id, name, imageUrl } = parsed.data;
  const slug = slugify(name) || "category";
  const clash = await db.category.findFirst({ where: { storeId: store.id, slug, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return { error: "A category with this name already exists" };
  if (id) await db.category.updateMany({ where: { id, storeId: store.id }, data: { name, slug, imageUrl: imageUrl || null } });
  else {
    const count = await db.category.count({ where: { storeId: store.id } });
    await db.category.create({ data: { storeId: store.id, name, slug, imageUrl: imageUrl || null, position: count } });
  }
  revalidatePath("/dashboard/categories");
  return {};
}

export async function deleteCategoryAction(form: FormData) {
  const { store } = await assertStorePermission("products.manage");
  await db.category.deleteMany({ where: { id: String(form.get("id")), storeId: store.id } });
  revalidatePath("/dashboard/categories");
}
