import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { can, type Permission } from "./permissions";

export const ACTIVE_STORE_COOKIE = "sh_store";

/** Every store the user belongs to, with their role. */
export const getMemberships = cache(async (userId: string) =>
  db.storeMember.findMany({
    where: { userId },
    include: { store: { select: { id: true, name: true, slug: true, status: true } } },
    orderBy: { createdAt: "asc" },
  }),
);

/**
 * Resolves the store the dashboard is working on and asserts the user may
 * perform `permission` on it. All tenant data access in the dashboard must be
 * scoped with the returned `store.id` — never with an id taken from the client.
 */
export const requireStore = cache(async (permission?: Permission) => {
  const user = await requireUser();
  const memberships = await getMemberships(user.id);
  if (memberships.length === 0) redirect("/onboarding");

  const preferred = (await cookies()).get(ACTIVE_STORE_COOKIE)?.value;
  const membership = memberships.find((m) => m.storeId === preferred) ?? memberships[0];

  const store = await db.store.findUniqueOrThrow({
    where: { id: membership.storeId },
    include: { settings: true },
  });
  if (store.status === "SUSPENDED" && user.role !== "PLATFORM_ADMIN") redirect("/suspended");
  if (permission && !can(membership.role, permission)) redirect("/dashboard?denied=1");

  return { user, store, role: membership.role, memberships };
});

export type StoreContext = Awaited<ReturnType<typeof requireStore>>;

/** For server actions: same as requireStore but throws instead of redirecting on permission failure. */
export async function assertStorePermission(permission: Permission): Promise<StoreContext> {
  const ctx = await requireStore();
  if (!can(ctx.role, permission)) throw new Error("You do not have permission to do that.");
  return ctx;
}

export type { CurrentUser };
