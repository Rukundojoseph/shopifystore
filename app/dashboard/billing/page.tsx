import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { getStorePlan } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { Alert, Badge, Button, Card, PageHeader, cn } from "@/components/ui";
import { requestPlanAction } from "./actions";

export const metadata = { title: "Plan & billing" };

export default async function BillingPage() {
  const { store } = await requireStore("billing.manage");
  const [{ plan: current, subscription }, plans, lastRequest] = await Promise.all([
    getStorePlan(store.id),
    db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { position: "asc" } }),
    db.auditLog.findFirst({ where: { storeId: store.id, action: "subscription.request" }, orderBy: { createdAt: "desc" } }),
  ]);
  const requested = (lastRequest?.metadata as { plan?: string } | null)?.plan;

  return (
    <>
      <PageHeader title="Plan & billing" description={<>You&apos;re on the <b>{current?.name ?? "Starter"}</b> plan{subscription?.currentPeriodEnd ? `, renews ${subscription.currentPeriodEnd.toLocaleDateString("en-RW")}` : ""}.</>} />
      {requested && requested !== current?.key && (
        <div className="mb-4"><Alert tone="info">You requested the <b>{plans.find((p) => p.key === requested)?.name}</b> plan on {lastRequest!.createdAt.toLocaleDateString("en-RW")}. Our team will contact you to arrange payment by MoMo or bank transfer.</Alert></div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.key === current?.key;
          return (
            <Card key={p.id} className={cn("flex flex-col p-6", p.key === "business" && "border-brand-500 ring-1 ring-brand-500")}>
              <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{p.name}</h3>{p.key === "business" && <Badge color="green">Most popular</Badge>}</div>
              <p className="mt-1 text-sm text-zinc-500">{p.description}</p>
              <p className="mt-4 text-3xl font-semibold">{p.priceMonthly ? formatMoney(p.priceMonthly) : "Free"}{p.priceMonthly > 0 && <span className="text-sm font-normal text-zinc-500"> / month</span>}</p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{f}</li>)}
              </ul>
              <form action={requestPlanAction} className="mt-6">
                <input type="hidden" name="plan" value={p.key} />
                <Button className="w-full" variant={isCurrent ? "outline" : "primary"} disabled={isCurrent}>{isCurrent ? "Current plan" : `Switch to ${p.name}`}</Button>
              </form>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-zinc-500">Prices are indicative while we finalise pricing for the Rwandan market. Subscription payments are arranged manually during the pilot.</p>
    </>
  );
}
