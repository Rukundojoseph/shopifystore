import { db } from "@/lib/db";
import { requireStore } from "@/lib/tenants";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CategoryEditor } from "./category-editor";
import { CategoryRow } from "./category-row";
import { deleteCategoryAction } from "./actions";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { store } = await requireStore("products.manage");
  const cats = await db.category.findMany({ where: { storeId: store.id }, orderBy: [{ position: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  return (
    <>
      <PageHeader title="Categories" description="Group products so customers can browse, e.g. Women, Men, Shoes." />
      <Card className="mb-6 p-5"><CategoryEditor /></Card>
      <Card>
        <CardHeader title={`${cats.length} categories`} />
        {cats.length ? (
          <div className="divide-y divide-zinc-100">
            {cats.map((c) => (
              <CategoryRow
                key={c.id}
                c={c}
                count={c._count.products}
                deleteForm={<form action={deleteCategoryAction}><input type="hidden" name="id" value={c.id} /><button className="text-sm text-red-600 hover:underline">Delete</button></form>}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No categories yet" description="Add one above. Products without a category still appear under All products." />
        )}
      </Card>
    </>
  );
}
