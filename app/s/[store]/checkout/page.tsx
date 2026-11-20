import { StorePage } from "@/components/storefront/store-page";
import { SystemPage } from "@/components/storefront/site-frame";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { href } from "@/components/storefront/types";
import { storeMetadata } from "@/lib/storefront/metadata";
import { resolveStore } from "@/lib/tenants/resolve";
import { momoAvailable } from "@/lib/payments/momo";

type P = { params: Promise<{ store: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: P) {
  const meta = await storeMetadata((await params).store, { title: "Checkout" });
  return { ...meta, robots: { index: false } };
}

export default async function CheckoutPage({ params, searchParams }: P) {
  const { store: key } = await params;
  const { preview } = await searchParams;
  const store = await resolveStore(key);
  const s = store?.settings;
  return (
    <StorePage storeKey={key} preview={preview === "draft"}>
      {({ ctx, config }) => (
        <SystemPage kind="checkout" sections={config.systemPages?.checkout} ctx={ctx}>
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
        </SystemPage>
      )}
    </StorePage>
  );
}
