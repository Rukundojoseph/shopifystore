import "server-only";
import type { Metadata } from "next";
import { resolveStore } from "@/lib/tenants/resolve";
import { parseConfig } from "./data";

export async function storeMetadata(key: string, page?: { title?: string; description?: string; image?: string | null }): Promise<Metadata> {
  const store = await resolveStore(key);
  if (!store) return {};
  const config = parseConfig(store.publishedConfig ?? store.draftConfig, store);
  const siteTitle = config.seo.title || store.name;
  const description = page?.description || config.seo.description || store.description || undefined;
  const image = page?.image || config.seo.image;
  const noindex = config.seo.noindex || store.status !== "PUBLISHED";
  return {
    title: page?.title ? `${page.title} | ${siteTitle}` : siteTitle,
    description,
    openGraph: { title: page?.title ?? siteTitle, description, siteName: store.name, images: image ? [image] : undefined, type: "website" },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}
