import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { Logo } from "@/components/ui";
import { logoutAction } from "@/app/(auth)/actions";

const NAV = [
  ["/admin", "Analytics"], ["/admin/stores", "Stores"], ["/admin/users", "Users"], ["/admin/plans", "Plans"],
  ["/admin/payments", "Payments"], ["/admin/templates", "Templates"], ["/admin/logs", "System logs"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2"><Logo className="text-white" /><span className="rounded bg-sun px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-900">Admin</span></Link>
          <nav className="flex gap-1 overflow-x-auto text-sm">
            {NAV.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-zinc-300 hover:bg-white/10 hover:text-white">{label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-zinc-400">
            <span className="hidden md:inline">{admin.email}</span>
            <Link href="/dashboard" className="hover:text-white">My stores</Link>
            <form action={logoutAction}><button className="hover:text-white">Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
