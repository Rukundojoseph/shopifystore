import type { Prisma, StoreStatus } from "@prisma/client";
import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Button, Card, Input, PageHeader, Select, cn } from "@/components/ui";
import { setStorePlanAction, setStoreStatusAction, verifyDomainAction } from "../actions";
import { storeUrl } from "@/lib/urls";

export const metadata = { title: "Stores" };

export default async function AdminStores({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const where: Prisma.StoreWhereInput = {
    ...(status && ["DRAFT", "PUBLISHED", "SUSPENDED"].includes(status) ? { status: status as StoreStatus } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }] } : {}),
  };
  const [stores, plans, requests] = await Promise.all([
    db.store.findMany({
      where, orderBy: { createdAt: "desc" }, take: 100,
      include: {
        owner: { select: { name: true, email: true } },
        domains: true,
        subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] } }, include: { plan: true }, take: 1, orderBy: { createdAt: "desc" } },
        _count: { select: { products: true, orders: true } },
      },
    }),
    db.subscriptionPlan.findMany({ orderBy: { position: "asc" } }),
    db.auditLog.findMany({ where: { action: "subscription.request" }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const pendingReq = new Map<string, string>();
  for (const r of requests) if (r.storeId && !pendingReq.has(r.storeId)) pendingReq.set(r.storeId, (r.metadata as { plan?: string })?.plan ?? "");

  return (
    <>
      <PageHeader title="Stores" />
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "PUBLISHED", "DRAFT", "SUSPENDED"].map((s) => (
          <Link key={s} href={s ? `?status=${s}` : "?"} className={cn("rounded-full border px-3 py-1 text-sm", (status ?? "") === s ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white")}>{s || "All"}</Link>
        ))}
        <form className="ml-auto flex gap-2"><Input name="q" defaultValue={q} placeholder="Search stores" /><Button variant="outline">Search</Button></form>
      </div>
      <div className="flex flex-col gap-4">
        {stores.map((s) => {
          const sub = s.subscriptions[0];
          const req = pendingReq.get(s.id);
          return (
            <Card key={s.id} className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{s.name}</p>
                    <Badge color={s.status === "PUBLISHED" ? "green" : s.status === "SUSPENDED" ? "red" : "yellow"}>{s.status}</Badge>
                    <Badge color="blue">{sub?.plan.name ?? "No plan"}{sub?.status === "TRIALING" ? " (trial)" : ""}</Badge>
                    {req && req !== sub?.plan.key && <Badge color="purple">Requested: {req}</Badge>}
                  </div>
                  <p className="text-sm text-zinc-500">{s.owner.name} · {s.owner.email} · {s._count.products} products · {s._count.orders} orders · {s.category}</p>
                  <a href={storeUrl(s.slug)} target="_blank" rel="noreferrer" className="text-sm text-brand-700">{storeUrl(s.slug)}</a>
                  {s.domains.filter((d) => d.type === "CUSTOM").map((d) => (
                    <form key={d.id} action={verifyDomainAction} className="mt-1 flex items-center gap-2 text-sm">
                      <input type="hidden" name="id" value={d.id} /><input type="hidden" name="verify" value={d.verifiedAt ? "0" : "1"} />
                      <span>{d.domain}</span>{d.verifiedAt ? <Badge color="green">verified</Badge> : <Badge color="yellow">pending</Badge>}
                      <button className="text-xs text-brand-700 underline">{d.verifiedAt ? "Unverify" : "Mark verified"}</button>
                    </form>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <form action={setStorePlanAction} className="flex items-center gap-2">
                    <input type="hidden" name="storeId" value={s.id} />
                    <Select name="plan" defaultValue={req || sub?.plan.key || "starter"} className="h-8 w-36 text-xs">{plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</Select>
                    <Input name="months" type="number" min={1} max={24} defaultValue={1} className="h-8 w-16 text-xs" title="Months paid" />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="trial" /> Trial</label>
                    <Button size="sm" variant="outline">Set plan</Button>
                  </form>
                  <form action={setStoreStatusAction} className="self-end">
                    <input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value={s.status === "SUSPENDED" ? "RESTORE" : "SUSPENDED"} />
                    <Button size="sm" variant={s.status === "SUSPENDED" ? "primary" : "danger"}>{s.status === "SUSPENDED" ? "Restore store" : "Suspend store"}</Button>
                  </form>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
