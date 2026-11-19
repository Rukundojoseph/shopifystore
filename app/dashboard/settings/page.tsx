import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { momoAvailable } from "@/lib/payments/momo";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { AddDomainForm, CommerceForm, StoreDetailsForm } from "./forms";
import { removeDomainAction } from "./actions";
import { ROOT_DOMAIN } from "@/lib/urls";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { store } = await requireStore("store.settings");
  const domains = await db.storeDomain.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "asc" } });
  const mode = momoAvailable().mode;
  const momoNote =
    mode === "live" ? "Customers approve the payment on their phone. Collected through the platform's MTN account." :
    mode === "simulator" ? "Dev simulator active — MTN credentials not set yet. No real money moves." :
    "Not available yet: the platform's MTN credentials have not been configured.";

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6">
        <Card><CardHeader title="Store details" description="Shown on your website's contact section and footer" /><StoreDetailsForm store={store} /></Card>
        <Card id="payments">
          <CardHeader title="Delivery & payments" description="Prices are charged in RWF" />
          <CommerceForm settings={store.settings ?? { deliveryFee: 0, freeDeliveryOver: null, acceptMomo: true, acceptCashOnDelivery: true }} momoNote={momoNote} />
        </Card>
        <Card>
          <CardHeader title="Domains" description="Your store is always available on its platform subdomain" />
          <ul className="divide-y divide-zinc-100">
            {domains.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="font-medium">{d.domain}</span>
                {d.type === "SUBDOMAIN" ? <Badge color="blue">Platform</Badge> : d.verifiedAt ? <Badge color="green">Connected</Badge> : <Badge color="yellow">Pending verification</Badge>}
                {d.type === "CUSTOM" && (
                  <form action={removeDomainAction} className="ml-auto"><input type="hidden" name="id" value={d.id} /><button className="text-sm text-red-600 hover:underline">Remove</button></form>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-zinc-100 px-5 pt-4 text-sm text-zinc-600">
            To connect your own domain, add a <b>CNAME</b> record for <code>www</code> pointing to <code>stores.{ROOT_DOMAIN.split(":")[0]}</code> (or an A record for the root domain as provided by support), then add it below.
          </div>
          <AddDomainForm />
        </Card>
      </div>
    </>
  );
}
