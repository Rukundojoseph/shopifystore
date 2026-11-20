import { StorePage } from "@/components/storefront/store-page";
import { SystemPage } from "@/components/storefront/site-frame";
import { CartView } from "@/components/checkout/cart-view";
import { href } from "@/components/storefront/types";
import { storeMetadata } from "@/lib/storefront/metadata";

type P = { params: Promise<{ store: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: P) {
  return storeMetadata((await params).store, { title: "Your cart" });
}

export default async function CartPage({ params, searchParams }: P) {
  const { store } = await params;
  const { preview } = await searchParams;
  return (
    <StorePage storeKey={store} preview={preview === "draft"}>
      {({ ctx, config }) => (
        <SystemPage kind="cart" sections={config.systemPages?.cart} ctx={ctx}>
          <CartView currency={ctx.store.currency} checkoutHref={href(ctx, "/checkout")} shopHref={href(ctx, "/products")} productBase={href(ctx, "/products")} />
        </SystemPage>
      )}
    </StorePage>
  );
}
