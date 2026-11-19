import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { Badge, Button, Card, Input, PageHeader, Table, Td, Th } from "@/components/ui";
import { setUserRoleAction, setUserStatusAction } from "../actions";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requirePlatformAdmin();
  const { q } = await searchParams;
  const where: Prisma.UserWhereInput = q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {};
  const users = await db.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { ownedStores: true } } } });
  return (
    <>
      <PageHeader title="Users" description={`${users.length} shown`} />
      <Card>
        <form className="flex gap-2 border-b border-zinc-100 p-4"><Input name="q" defaultValue={q} placeholder="Search name or email" className="max-w-sm" /><Button variant="outline">Search</Button></form>
        <Table>
          <thead><tr><Th>User</Th><Th>Role</Th><Th>Status</Th><Th>Stores</Th><Th>Joined</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <Td><p className="font-medium">{u.name}</p><p className="text-xs text-zinc-500">{u.email}{u.emailVerifiedAt ? " ✓" : ""}</p></Td>
                <Td>{u.role === "PLATFORM_ADMIN" ? <Badge color="purple">Admin</Badge> : <Badge>User</Badge>}</Td>
                <Td>{u.status === "ACTIVE" ? <Badge color="green">Active</Badge> : <Badge color="red">Suspended</Badge>}</Td>
                <Td>{u._count.ownedStores}</Td>
                <Td className="text-zinc-500">{u.createdAt.toLocaleDateString("en-RW")}</Td>
                <Td>
                  {u.id !== admin.id && (
                    <div className="flex gap-2">
                      <form action={setUserStatusAction}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value={u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} /><Button size="sm" variant="outline">{u.status === "ACTIVE" ? "Suspend" : "Activate"}</Button></form>
                      <form action={setUserRoleAction}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="role" value={u.role === "PLATFORM_ADMIN" ? "USER" : "PLATFORM_ADMIN"} /><Button size="sm" variant="ghost">{u.role === "PLATFORM_ADMIN" ? "Remove admin" : "Make admin"}</Button></form>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
