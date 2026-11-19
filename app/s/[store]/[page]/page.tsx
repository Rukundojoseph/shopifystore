import { notFound } from "next/navigation";
import { StorePage } from "@/components/storefront/store-page";
import { SectionList } from "@/components/storefront/site-frame";
import { storeMetadata } from "@/lib/storefront/metadata";
import { resolveStore } from "@/lib/tenants/resolve";
import { parseConfig } from "@/lib/storefront/data";

type P = { params: Promise<{ store: string; page: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: P) {
  const { store: key, page } = await params;
  const store = await resolveStore(key);
  if (!store) return {};
  const p = parseConfig(store.publishedConfig ?? store.draftConfig, store).pages.find((x) => x.slug === `/${page}`);
  return storeMetadata(key, { title: p?.seoTitle || p?.name, description: p?.seoDescription });
}

export default async function StoreCustomPage({ params, searchParams }: P) {
  const { store, page } = await params;
  const { preview } = await searchParams;
  return (
    <StorePage storeKey={store} preview={preview === "draft"}>
      {({ ctx, config }) => {
        const p = config.pages.find((x) => x.slug === `/${page}`);
        if (!p) notFound();
        return <SectionList sections={p.sections} ctx={ctx} />;
      }}
    </StorePage>
  );
}
