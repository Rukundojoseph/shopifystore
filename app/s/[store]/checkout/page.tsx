import { StorePage } from "@/components/storefront/store-page";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { href } from "@/components/storefront/types";
import { storeMetadata } from "@/lib/storefront/metadata";
import { resolveStore } from "@/lib/tenants/resolve";
import { momoAvailable } from "@/lib/payments/momo";

type P = { params: Promise<{ store: string }> };

export async function generateMetadata({ params }: P) {
  const meta = await storeMetadata((await params).store, { title: "Checkout" });
  return { ...meta, robots: { index: false } };
}

export default async function CheckoutPage({ params }: P) {
  const { store: key } = await params;
  const store = await resolveStore(key);
  const s = store?.settings;
  return (
    <StorePage storeKey={key}>
      {({ ctx }) => (
        <CheckoutForm
          storeId={ctx.store.id}
          currency={ctx.store.currency}
          deliveryFee={s?.deliveryFee ?? 0}
          freeDeliveryOver={s?.freeDeliveryOver ?? null}
          methods={{ momo: (s?.acceptMomo ?? true) && momoAvailable().available, cod: s?.acceptCashOnDelivery ?? true }}
          momoMode={momoAvailable().mode}
          orderBase={href(ctx, "/orders")}
          cartHref={href(ctx, "/cart")}
          primaryColor={ctx.theme.primaryColor}
        />
      )}
    </StorePage>
  );
}
