import Link from "next/link";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { cn } from "@/components/ui";
import { deleteSubmissionAction } from "./actions";

export const metadata = { title: "Form submissions" };

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ form?: string }> }) {
  const { store } = await requireStore("customers.view");
  const { form } = await searchParams;
  const [forms, submissions] = await Promise.all([
    db.formSubmission.groupBy({ by: ["formName"], where: { storeId: store.id }, _count: true, orderBy: { formName: "asc" } }),
    db.formSubmission.findMany({ where: { storeId: store.id, ...(form ? { formName: form } : {}) }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  return (
    <>
      <PageHeader title="Form submissions" description="Messages sent through forms you built in the website editor." />
      {forms.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Link href="/dashboard/forms" className={cn("rounded-full border px-3 py-1", !form ? "border-brand-600 bg-brand-50 text-brand-700" : "border-zinc-200")}>All</Link>
          {forms.map((f) => (
            <Link key={f.formName} href={`/dashboard/forms?form=${encodeURIComponent(f.formName)}`} className={cn("rounded-full border px-3 py-1", form === f.formName ? "border-brand-600 bg-brand-50 text-brand-700" : "border-zinc-200")}>
              {f.formName} <span className="text-zinc-400">{f._count}</span>
            </Link>
          ))}
        </div>
      )}
      {submissions.length ? (
        <div className="flex flex-col gap-3">
          {submissions.map((s) => {
            const data = (s.data && typeof s.data === "object" && !Array.isArray(s.data) ? s.data : {}) as Record<string, unknown>;
            return (
              <Card key={s.id} className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{s.formName}</p>
                    <p className="text-xs text-zinc-500">{s.createdAt.toLocaleString("en-RW", { dateStyle: "medium", timeStyle: "short" })}{s.pagePath ? ` · from ${s.pagePath}` : ""}</p>
                  </div>
                  <form action={deleteSubmissionAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton message="Delete this submission permanently?" size="sm" variant="ghost" className="text-red-600">Delete</ConfirmButton>
                  </form>
                </div>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
                  {Object.entries(data).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-medium text-zinc-500">{k.replace(/_/g, " ")}</dt>
                      <dd className="whitespace-pre-line break-words">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState title="No submissions yet" description="Add a Form element to any page in the website editor. Messages people send appear here." /></Card>
      )}
    </>
  );
}
