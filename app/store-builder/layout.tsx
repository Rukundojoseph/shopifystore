import { requireStore } from "@/lib/tenants";

export default async function BuilderLayout({ children }: { children: React.ReactNode }) {
  await requireStore("store.design");
  return <div className="min-h-screen bg-zinc-100">{children}</div>;
}
