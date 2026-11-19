"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertStorePermission } from "@/lib/tenants";
import { assertCanAddProduct } from "@/lib/plans";
import { slugify } from "@/lib/slug";
import { audit } from "@/lib/audit";

const imageUrl = z.string().max(1000).refine((u) => u.startsWith("/uploads/") || u.startsWith("https://"), "Invalid image URL");

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Enter a product name").max(200),
  description: z.string().max(10_000).optional().default(""),
  price: z.number().int("Whole RWF only").min(0).max(1_000_000_000),
  compareAtPrice: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  sku: z.string().trim().max(80).optional().default(""),
  stockQuantity: z.number().int().min(0).max(10_000_000),
  trackInventory: z.boolean(),
  status: z.enum(["DRAFT", "ACTIVE"]),
  featured: z.boolean(),
  categoryId: z.string().uuid().nullable().optional(),
  images: z.array(imageUrl).max(10),
  options: z.array(z.object({ name: z.string().trim().min(1).max(40), values: z.array(z.string().trim().min(1).max(40)).min(1).max(30) })).max(3),
  variants: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().max(200),
        optionValues: z.record(z.string().max(40), z.string().max(40)),
        sku: z.string().trim().max(80).optional().default(""),
        price: z.number().int().min(0).max(1_000_000_000).nullable(),
        stockQuantity: z.number().int().min(0).max(10_000_000),
      }),
    )
    .max(100),
  seoTitle: z.string().max(120).optional().default(""),
  seoDescription: z.string().max(300).optional().default(""),
});

export type ProductInput = z.input<typeof productSchema>;

async function uniqueSlug(storeId: string, name: string, exceptId?: string) {
  const base = slugify(name) || "product";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await db.product.findFirst({ where: { storeId, slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function saveProductAction(raw: ProductInput): Promise<{ error?: string; id?: string }> {
  const { store, user } = await assertStorePermission("products.manage");
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid product" };
  const d = parsed.data;
  if (d.compareAtPrice != null && d.compareAtPrice <= d.price) d.compareAtPrice = null;

  if (d.categoryId) {
    const cat = await db.category.findFirst({ where: { id: d.categoryId, storeId: store.id } });
    if (!cat) return { error: "Category not found" };
  }

  const data = {
    name: d.name,
    description: d.description || null,
    price: d.price,
    compareAtPrice: d.compareAtPrice ?? null,
    sku: d.sku || null,
    stockQuantity: d.stockQuantity,
    trackInventory: d.trackInventory,
    status: d.status,
    featured: d.featured,
    categoryId: d.categoryId ?? null,
    images: d.images,
    options: d.options.length ? (d.options as Prisma.InputJsonValue) : undefined,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
  };

  let productId: string;
  if (d.id) {
    const existing = await db.product.findFirst({ where: { id: d.id, storeId: store.id } });
    if (!existing) return { error: "Product not found" };
    productId = d.id;
    await db.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: { ...data, options: d.options.length ? (d.options as Prisma.InputJsonValue) : [], slug: existing.name === d.name ? existing.slug : await uniqueSlug(store.id, d.name, productId) } });
      const keep = d.variants.filter((v) => v.id).map((v) => v.id!);
      await tx.productVariant.deleteMany({ where: { productId, storeId: store.id, id: { notIn: keep } } });
      for (const [i, v] of d.variants.entries()) {
        const vd = { title: v.title, optionValues: v.optionValues, sku: v.sku || null, price: v.price, stockQuantity: v.stockQuantity, position: i };
        if (v.id) await tx.productVariant.updateMany({ where: { id: v.id, productId, storeId: store.id }, data: vd });
        else await tx.productVariant.create({ data: { ...vd, productId, storeId: store.id } });
      }
    });
    await audit({ action: "product.update", userId: user.id, storeId: store.id, metadata: { productId } });
  } else {
    try {
      await assertCanAddProduct(store.id);
    } catch (e) {
      return { error: (e as Error).message };
    }
    const created = await db.product.create({
      data: {
        ...data,
        storeId: store.id,
        slug: await uniqueSlug(store.id, d.name),
        variants: { create: d.variants.map((v, i) => ({ storeId: store.id, title: v.title, optionValues: v.optionValues, sku: v.sku || null, price: v.price, stockQuantity: v.stockQuantity, position: i })) },
      },
    });
    productId = created.id;
    await audit({ action: "product.create", userId: user.id, storeId: store.id, metadata: { productId } });
  }
  revalidatePath("/dashboard/products");
  return { id: productId };
}

export async function deleteProductAction(form: FormData) {
  const { store, user } = await assertStorePermission("products.manage");
  const id = String(form.get("id"));
  const { count } = await db.product.deleteMany({ where: { id, storeId: store.id } });
  if (count) await audit({ action: "product.delete", userId: user.id, storeId: store.id, metadata: { productId: id } });
  revalidatePath("/dashboard/products");
  redirect("/dashboard/products");
}

export async function setProductStatusAction(form: FormData) {
  const { store } = await assertStorePermission("products.manage");
  const status = form.get("status") === "ACTIVE" ? "ACTIVE" : "DRAFT";
  await db.product.updateMany({ where: { id: String(form.get("id")), storeId: store.id }, data: { status } });
  revalidatePath("/dashboard/products");
}

export async function updateStockAction(form: FormData) {
  const { store } = await assertStorePermission("products.manage");
  const qty = Math.max(0, Math.floor(Number(form.get("stock"))));
  if (!Number.isFinite(qty)) return;
  const id = String(form.get("id"));
  if (form.get("kind") === "variant") await db.productVariant.updateMany({ where: { id, storeId: store.id }, data: { stockQuantity: qty } });
  else await db.product.updateMany({ where: { id, storeId: store.id }, data: { stockQuantity: qty } });
  revalidatePath("/dashboard/inventory");
}
