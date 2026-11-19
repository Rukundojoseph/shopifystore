import { db } from "@/lib/db";
import { TEMPLATES } from "@/templates";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Templates" };

export default async function AdminTemplates() {
  const usage = await db.store.groupBy({ by: ["templateKey"], _count: true });
  const count = Object.fromEntries(usage.map((u) => [u.templateKey ?? "", u._count]));
  return (
    <>
      <PageHeader title="Templates" description="Templates are versioned in code (templates/index.ts) and rendered by the shared storefront renderer." />
      <Card>
        <Table>
          <thead><tr><Th>Template</Th><Th>Category</Th><Th>Fonts</Th><Th>Colours</Th><Th>Stores using</Th></tr></thead>
          <tbody>
            {TEMPLATES.map((t) => (
              <tr key={t.key}>
                <Td><p className="font-medium">{t.name}</p><p className="text-xs text-zinc-500">{t.key}</p></Td>
                <Td>{t.category}</Td>
                <Td className="text-zinc-600">{t.theme.headingFont} / {t.theme.font}</Td>
                <Td><div className="flex gap-1">{[t.theme.primaryColor, t.theme.secondaryColor, t.theme.backgroundColor, t.theme.textColor].map((c) => <span key={c} className="h-5 w-5 rounded border border-zinc-200" style={{ background: c }} title={c} />)}</div></Td>
                <Td>{count[t.key] ?? 0}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
