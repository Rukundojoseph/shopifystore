import { StorePage } from "@/components/storefront/store-page";
import { SectionList } from "@/components/storefront/site-frame";
import { storeMetadata } from "@/lib/storefront/metadata";

type P = { params: Promise<{ store: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: P) {
  return storeMetadata((await params).store);
}

export default async function StoreHome({ params, searchParams }: P) {
  const { store } = await params;
  const { preview } = await searchParams;
  return (
    <StorePage storeKey={store} preview={preview === "draft"}>
      {({ ctx, config }) => <SectionList sections={config.pages.find((p) => p.slug === "/")?.sections ?? []} ctx={ctx} />}
    </StorePage>
  );
}
