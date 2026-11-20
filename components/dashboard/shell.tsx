"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  LayoutDashboard, Package, Tags, Boxes, ShoppingCart, Users, CreditCard, Paintbrush, LayoutTemplate,
  Settings, Gem, ExternalLink, Menu, X, LogOut, Shield, UserCircle, Inbox,
} from "lucide-react";
import type { StoreRole } from "@prisma/client";
import { Logo, cn } from "@/components/ui";
import { can, type Permission } from "@/lib/tenants/permissions";
import { logoutAction } from "@/app/(auth)/actions";
import { switchStoreAction } from "@/app/dashboard/actions";
import { storeUrl } from "@/lib/urls";

const NAV: { href: string; label: string; icon: typeof Package; perm?: Permission }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart, perm: "orders.view" },
  { href: "/dashboard/products", label: "Products", icon: Package, perm: "products.manage" },
  { href: "/dashboard/categories", label: "Categories", icon: Tags, perm: "products.manage" },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes, perm: "products.manage" },
  { href: "/dashboard/customers", label: "Customers", icon: Users, perm: "customers.view" },
  { href: "/dashboard/forms", label: "Form submissions", icon: Inbox, perm: "customers.view" },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard, perm: "payments.view" },
  { href: "/store-builder/editor", label: "Website editor", icon: Paintbrush, perm: "store.design" },
  { href: "/store-builder/templates", label: "Templates", icon: LayoutTemplate, perm: "store.design" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, perm: "store.settings" },
  { href: "/dashboard/billing", label: "Plan & billing", icon: Gem, perm: "billing.manage" },
];

type Props = {
  user: { name: string; email: string; isAdmin: boolean };
  store: { id: string; name: string; slug: string; status: string };
  role: StoreRole;
  /** Served on the store's own subdomain / custom domain (dashboard locked to it). */
  onStoreDomain: boolean;
  stores: { id: string; name: string; slug: string }[];
  unverified: boolean;
  resend: () => Promise<void>;
  children: React.ReactNode;
};

export function DashboardShell({ user, store, role, onStoreDomain, stores, unverified, resend, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const items = NAV.filter((n) => !n.perm || can(role, n.perm));

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((n) => {
        const active = n.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition", active ? "bg-brand-50 text-brand-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900")}>
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col gap-5 p-4">
      <Link href="/dashboard" className="px-2"><Logo /></Link>
      <div className="rounded-lg border border-zinc-200 p-3">
        {stores.length > 1 && onStoreDomain ? (
          // On a store domain each store's dashboard lives on its own subdomain.
          <select defaultValue={store.id} onChange={(e) => { const s = stores.find((x) => x.id === e.target.value); if (s) window.location.href = storeUrl(s.slug, "/dashboard"); }} className="w-full bg-transparent text-sm font-semibold outline-none" aria-label="Switch store">
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : stores.length > 1 ? (
          <form action={switchStoreAction}>
            <select name="storeId" defaultValue={store.id} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="w-full bg-transparent text-sm font-semibold outline-none">
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </form>
        ) : (
          <p className="truncate text-sm font-semibold">{store.name}</p>
        )}
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className={cn("font-medium", store.status === "PUBLISHED" ? "text-green-700" : "text-amber-700")}>{store.status === "PUBLISHED" ? "● Live" : "● Draft"}</span>
          <a href={store.status === "PUBLISHED" ? (onStoreDomain ? "/" : storeUrl(store.slug)) : onStoreDomain ? "/?preview=draft" : `/s/${store.slug}?preview=draft`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900">View store <ExternalLink className="h-3 w-3" /></a>
        </div>
        {!onStoreDomain && (
          <a href={storeUrl(store.slug, "/dashboard")} className="mt-2 block truncate border-t border-zinc-100 pt-2 text-[11px] text-zinc-500 hover:text-zinc-900" title="This store's dashboard on its own address">
            {storeUrl(store.slug, "/dashboard").replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
      {nav}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-zinc-100 pt-3">
        {user.isAdmin && <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"><Shield className="h-4 w-4" /> Platform admin</Link>}
        <Link href="/dashboard/account" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"><UserCircle className="h-4 w-4" /> <span className="truncate">{user.name}</span></Link>
        <form action={logoutAction}><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"><LogOut className="h-4 w-4" /> Sign out</button></form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white lg:block">{sidebar}</aside>
      <div className="no-print sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <Logo />
        <span className="w-5" />
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white">
            <button className="absolute right-3 top-4" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        {unverified && (
          <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
            Please verify your email address ({user.email}).{" "}
            <button disabled={pending || sent} onClick={() => start(async () => { await resend(); setSent(true); })} className="font-semibold underline disabled:no-underline">
              {sent ? "Verification email sent" : "Resend email"}
            </button>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
