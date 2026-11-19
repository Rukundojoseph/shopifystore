import { db } from "@/lib/db";
import { Card, Input, Button, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "System logs" };

export default async function AdminLogs({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const { action } = await searchParams;
  const logs = await db.auditLog.findMany({
    where: action ? { action: { startsWith: action } } : {},
    orderBy: { createdAt: "desc" }, take: 300,
    include: { user: { select: { email: true } }, store: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader title="System logs" description="Audit trail of sensitive operations" />
      <Card>
        <form className="flex gap-2 border-b border-zinc-100 p-4"><Input name="action" defaultValue={action} placeholder="Filter by action prefix, e.g. admin. or store.publish" className="max-w-sm" /><Button variant="outline">Filter</Button></form>
        <Table>
          <thead><tr><Th>Time</Th><Th>Action</Th><Th>User</Th><Th>Store</Th><Th>Details</Th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap text-zinc-500">{l.createdAt.toLocaleString("en-RW", { dateStyle: "short", timeStyle: "medium" })}</Td>
                <Td className="font-mono text-xs">{l.action}</Td>
                <Td>{l.user?.email ?? "—"}</Td>
                <Td>{l.store?.name ?? "—"}</Td>
                <Td className="max-w-md truncate font-mono text-xs text-zinc-500">{l.metadata ? JSON.stringify(l.metadata) : ""}{l.ip ? ` ip=${l.ip}` : ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
