import { db } from "@/lib/db";
import { Button, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { savePlanAction } from "../actions";

export const metadata = { title: "Subscription plans" };

export default async function AdminPlans() {
  const plans = await db.subscriptionPlan.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] } } } } } } });
  return (
    <>
      <PageHeader title="Subscription plans" description="Plan limits are enforced across the platform (product count, MoMo, custom domains, templates)." />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="p-5">
            <form action={savePlanAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={p.id} />
              <p className="text-xs text-zinc-500">key: {p.key} · {p._count.subscriptions} active</p>
              <Field label="Name"><Input name="name" defaultValue={p.name} /></Field>
              <Field label="Description"><Input name="description" defaultValue={p.description ?? ""} /></Field>
              <Field label="Price per month (RWF)"><Input name="priceMonthly" type="number" min={0} defaultValue={p.priceMonthly} /></Field>
              <Field label="Max products" hint="Empty = unlimited"><Input name="maxProducts" type="number" min={1} defaultValue={p.maxProducts ?? ""} /></Field>
              <Field label="Features (one per line)"><Textarea name="features" rows={6} defaultValue={p.features.join("\n")} /></Field>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="allowMomo" defaultChecked={p.allowMomo} /> MTN MoMo</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="allowCustomDomain" defaultChecked={p.allowCustomDomain} /> Custom domain</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="allTemplates" defaultChecked={p.allTemplates} /> All templates</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={p.isActive} /> Active</label>
              </div>
              <Button>Save plan</Button>
            </form>
          </Card>
        ))}
      </div>
    </>
  );
}
