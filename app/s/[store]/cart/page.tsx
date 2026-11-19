import { StorePage } from "@/components/storefront/store-page";
import { CartView } from "@/components/checkout/cart-view";
import { href } from "@/components/storefront/types";
import { storeMetadata } from "@/lib/storefront/metadata";

type P = { params: Promise<{ store: string }> };

export async function generateMetadata({ params }: P) {
  return storeMetadata((await params).store, { title: "Your cart" });
}

export default async function CartPage({ params }: P) {
  const { store } = await params;
  return (
    <StorePage storeKey={store}>
      {({ ctx }) => <CartView currency={ctx.store.currency} checkoutHref={href(ctx, "/checkout")} shopHref={href(ctx, "/products")} productBase={href(ctx, "/products")} />}
    </StorePage>
  );
}
