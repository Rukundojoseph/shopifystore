import { requireStore } from "@/lib/tenants";
import { DashboardShell } from "@/components/dashboard/shell";
import { resendVerificationAction } from "@/app/(auth)/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, store, role, memberships } = await requireStore();
  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, isAdmin: user.role === "PLATFORM_ADMIN" }}
      store={{ id: store.id, name: store.name, slug: store.slug, status: store.status }}
      role={role}
      stores={memberships.map((m) => ({ id: m.store.id, name: m.store.name }))}
      unverified={!user.emailVerifiedAt}
      resend={resendVerificationAction}
    >
      {children}
    </DashboardShell>
  );
}
