import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { can } from "@/lib/tenants/permissions";
import { loadProducts, parseConfig } from "@/lib/storefront/data";
import { parseSavedTemplate, type SavedTemplateItem } from "@/lib/editor/schema";
import { storeUrl } from "@/lib/urls";
import { Editor } from "@/components/editor/editor";
import type { StorefrontCtx } from "@/components/storefront/types";

export const metadata = { title: "Website editor" };

export default async function EditorPage() {
  const { store, role, onStoreDomain } = await requireStore("store.design");
  const config = parseConfig(store.draftConfig, store);
  const [products, categories, savedRows] = await Promise.all([
    loadProducts(store.id),
    db.category.findMany({ where: { storeId: store.id }, orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, imageUrl: true } }),
    db.savedTemplate.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const saved = savedRows.map(parseSavedTemplate).filter((x): x is SavedTemplateItem => x !== null);
  const ctx: StorefrontCtx = {
    store: { id: store.id, name: store.name, slug: store.slug, description: store.description, phone: store.phone, email: store.email, location: store.location, currency: store.currency },
    base: "",
    theme: config.theme,
    products,
    categories,
    editing: true,
  };
  return (
    <Editor
      initialConfig={config}
      ctx={ctx}
      previewBase={onStoreDomain ? "" : `/s/${store.slug}`}
      status={store.status}
      canPublish={can(role, "store.publish")}
      hasPublished={!!store.publishedConfig}
      publishedDiffers={JSON.stringify(store.draftConfig) !== JSON.stringify(store.publishedConfig)}
      liveUrl={storeUrl(store.slug)}
      initialSaved={saved}
    />
  );
}
