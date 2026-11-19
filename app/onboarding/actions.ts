"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { isValidStoreSlug, slugify } from "@/lib/slug";
import { normalizeRwandaPhone } from "@/lib/phone";
import { buildSiteConfig, templateForCategory } from "@/templates";
import { ACTIVE_STORE_COOKIE } from "@/lib/tenants";
import { audit } from "@/lib/audit";
import { BUSINESS_CATEGORIES } from "@/lib/categories";
import type { FormState } from "@/components/ui/form-message";

const schema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(120),
  name: z.string().trim().min(2, "Enter a store name").max(80),
  category: z.enum(BUSINESS_CATEGORIES.map((c) => c.value) as [string, ...string[]]),
  description: z.string().trim().max(500).optional(),
  phone: z.string().trim().min(9, "Enter a phone number").max(20),
  email: z.string().trim().email("Enter a valid email").max(200),
  location: z.string().trim().min(2, "Enter your location").max(200),
  slug: z.string().trim().toLowerCase(),
  currency: z.enum(["RWF"]).default("RWF"),
});

export async function checkSlugAction(slug: string): Promise<{ ok: boolean; message: string }> {
  await requireUser();
  const s = slugify(slug);
  if (!isValidStoreSlug(s)) return { ok: false, message: "Use 3–40 letters, numbers or dashes" };
  const taken = await db.store.findUnique({ where: { slug: s }, select: { id: true } });
  return taken ? { ok: false, message: "This address is taken" } : { ok: true, message: "Available" };
}

export async function createStoreAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors: fe };
  }
  const d = parsed.data;
  const slug = slugify(d.slug || d.name);
  if (!isValidStoreSlug(slug)) return { error: "Choose a different store address.", fieldErrors: { slug: "Use 3–40 letters, numbers or dashes" } };
  const phone = normalizeRwandaPhone(d.phone);
  if (!phone) return { error: "Please fix the highlighted fields.", fieldErrors: { phone: "Enter a Rwandan mobile number, e.g. 078 123 4567" } };

  const owned = await db.store.count({ where: { ownerId: user.id } });
  if (owned >= 5) return { error: "You can create up to 5 stores per account." };

  const templateKey = templateForCategory(d.category);
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const starter = await db.subscriptionPlan.findUnique({ where: { key: "starter" } });

  try {
    const store = await db.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          ownerId: user.id,
          businessName: d.businessName,
          name: d.name,
          slug,
          category: d.category,
          description: d.description || null,
          phone: `+${phone}`,
          email: d.email,
          location: d.location,
          currency: d.currency,
          templateKey,
          draftConfig: buildSiteConfig(templateKey, d.name, d.description),
          members: { create: { userId: user.id, role: "OWNER" } },
          settings: { create: { deliveryFee: 2000, freeDeliveryOver: 50000 } },
          domains: { create: { domain: `${slug}.${root.split(":")[0]}`, type: "SUBDOMAIN", verifiedAt: new Date(), isPrimary: true } },
        },
      });
      if (starter) await tx.subscription.create({ data: { storeId: store.id, planId: starter.id, status: "ACTIVE" } });
      return store;
    });
    (await cookies()).set(ACTIVE_STORE_COOKIE, store.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    await audit({ action: "store.create", userId: user.id, storeId: store.id });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "That store address was just taken.", fieldErrors: { slug: "This address is taken" } };
    throw e;
  }
  redirect("/store-builder/templates?welcome=1");
}
