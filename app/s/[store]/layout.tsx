import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { resolveStore } from "@/lib/tenants/resolve";
import { CartProvider } from "@/components/storefront/cart";

export default async function StoreLayout({ children, params }: { children: ReactNode; params: Promise<{ store: string }> }) {
  const { store: key } = await params;
  const store = await resolveStore(key);
  if (!store || store.status === "SUSPENDED") notFound();
  return <CartProvider storeId={store.id}>{children}</CartProvider>;
}
