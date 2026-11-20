"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertStorePermission } from "@/lib/tenants";
import { parseSavedTemplate, savedBlockSchema, savedPageSchema, siteConfigSchema, type SavedTemplateItem, type SiteConfig } from "@/lib/editor/schema";
import { SECTION_MAP } from "@/lib/editor/sections";
import { buildSiteConfig, TEMPLATE_MAP } from "@/templates";
import { audit } from "@/lib/audit";
import { tailwindCss } from "@/lib/storefront/tailwind-css";

function validate(raw: unknown): { config?: SiteConfig; error?: string } {
  const parsed = siteConfigSchema.safeParse(raw);
  if (!parsed.success) return { error: `Invalid design: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}` };
  const c = parsed.data;
  if (c.header.type !== "header" || c.footer.type !== "footer") return { error: "Invalid header/footer" };
  if (!c.pages.some((p) => p.slug === "/")) return { error: "A home page is required" };
  const slugs = new Set<string>();
  for (const p of c.pages) {
    if (slugs.has(p.slug)) return { error: `Two pages use the address ${p.slug}` };
    if (["/products", "/collections", "/cart", "/checkout", "/orders", "/sitemap.xml", "/robots.txt", "/dashboard", "/store-builder", "/login", "/forgot-password", "/reset-password"].includes(p.slug)) return { error: `${p.slug} is reserved` };
    slugs.add(p.slug);
    for (const s of p.sections) if (!SECTION_MAP[s.type] || SECTION_MAP[s.type].global || SECTION_MAP[s.type].system) return { error: `Unknown section type ${s.type}` };
  }
  // Built-in shop pages: exactly one main block of their own kind, plus ordinary sections.
  for (const [kind, sections] of Object.entries(c.systemPages ?? {})) {
    if (!sections) continue;
    const main = `${kind}-main`;
    if (sections.filter((s) => s.type === main).length !== 1) return { error: `The ${kind} page must keep its main content block` };
    for (const s of sections) {
      const def = SECTION_MAP[s.type];
      if (!def || def.global || (def.system && s.type !== main)) return { error: `Unknown section type ${s.type}` };
    }
  }
  const ids = new Set<string>();
  for (const w of c.workflows ?? []) {
    if (ids.has(w.id)) return { error: "Two workflows share an id" };
    ids.add(w.id);
  }
  return { config: c };
}

export async function saveDraftAction(raw: unknown): Promise<{ ok?: true; error?: string; savedAt?: string }> {
  const { store } = await assertStorePermission("store.design");
  const { config, error } = validate(raw);
  if (!config) return { error };
  if (JSON.stringify(config).length > 500_000) return { error: "Design is too large" };
  const updated = await db.store.update({ where: { id: store.id }, data: { draftConfig: config as Prisma.InputJsonValue }, select: { updatedAt: true } });
  return { ok: true, savedAt: updated.updatedAt.toISOString() };
}

export async function publishAction(raw: unknown): Promise<{ ok?: true; error?: string }> {
  const { store, user } = await assertStorePermission("store.publish");
  const { config, error } = validate(raw);
  if (!config) return { error };
  await db.store.update({
    where: { id: store.id },
    data: { draftConfig: config as Prisma.InputJsonValue, publishedConfig: config as Prisma.InputJsonValue, publishedAt: new Date(), status: store.status === "SUSPENDED" ? "SUSPENDED" : "PUBLISHED" },
  });
  await audit({ action: "store.publish", userId: user.id, storeId: store.id });
  revalidatePath(`/s/${store.slug}`, "layout");
  return { ok: true };
}

export async function unpublishAction() {
  const { store, user } = await assertStorePermission("store.publish");
  await db.store.update({ where: { id: store.id }, data: { status: "DRAFT" } });
  await audit({ action: "store.unpublish", userId: user.id, storeId: store.id });
  revalidatePath("/store-builder/editor");
}

export async function discardDraftAction(): Promise<{ config?: SiteConfig; error?: string }> {
  const { store } = await assertStorePermission("store.design");
  if (!store.publishedConfig) return { error: "Nothing has been published yet" };
  await db.store.update({ where: { id: store.id }, data: { draftConfig: store.publishedConfig as Prisma.InputJsonValue } });
  return { config: store.publishedConfig as SiteConfig };
}

export async function applyTemplateAction(form: FormData) {
  const { store, user } = await assertStorePermission("store.design");
  const key = String(form.get("template"));
  if (!TEMPLATE_MAP[key]) return;
  const config = buildSiteConfig(key, store.name, store.description);
  await db.store.update({ where: { id: store.id }, data: { templateKey: key, draftConfig: config as Prisma.InputJsonValue } });
  await audit({ action: "store.template", userId: user.id, storeId: store.id, metadata: { template: key } });
  redirect("/store-builder/editor?template=1");
}

// ─── Saved blocks & page templates ──────────────────────────────────────────

const MAX_SAVED_TEMPLATES = 100;

export async function saveTemplateAction(input: { kind: "BLOCK" | "PAGE"; name: string; data: unknown }): Promise<{ item?: SavedTemplateItem; error?: string }> {
  const { store, user } = await assertStorePermission("store.design");
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give it a name" };
  if (input.kind !== "BLOCK" && input.kind !== "PAGE") return { error: "Invalid template type" };
  const parsed = input.kind === "BLOCK" ? savedBlockSchema.safeParse(input.data) : savedPageSchema.safeParse(input.data);
  if (!parsed.success) return { error: `Invalid design: ${parsed.error.issues[0]?.message ?? "unknown error"}` };
  if (JSON.stringify(parsed.data).length > 200_000) return { error: "This design is too large to save" };
  if ((await db.savedTemplate.count({ where: { storeId: store.id } })) >= MAX_SAVED_TEMPLATES) return { error: `You can keep up to ${MAX_SAVED_TEMPLATES} saved designs. Delete one first.` };
  const row = await db.savedTemplate.create({ data: { storeId: store.id, kind: input.kind, name, data: parsed.data as Prisma.InputJsonValue, createdById: user.id } });
  return { item: parseSavedTemplate(row) ?? undefined };
}

export async function deleteTemplateAction(id: string): Promise<{ ok?: true; error?: string }> {
  const { store } = await assertStorePermission("store.design");
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return { error: "Not found" };
  // Scoped by store: another store's id simply matches nothing.
  const res = await db.savedTemplate.deleteMany({ where: { id: String(id), storeId: store.id } });
  return res.count ? { ok: true } : { error: "Not found" };
}

/** CSS for the custom Tailwind classes in the editor (live preview on the canvas). */
export async function tailwindCssAction(classes: string[]): Promise<{ css: string }> {
  await assertStorePermission("store.design");
  if (!Array.isArray(classes)) return { css: "" };
  // tailwindCss() re-validates every class name.
  return { css: await tailwindCss(classes.slice(0, 2000).filter((c): c is string => typeof c === "string" && c.length <= 120)) };
}
