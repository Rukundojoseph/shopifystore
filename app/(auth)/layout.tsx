import Link from "next/link";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,163,108,0.55),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(250,210,1,0.25),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="max-w-md text-3xl font-semibold leading-tight">“We moved from WhatsApp orders to a real online shop in one afternoon.”</p>
          <p className="mt-4 text-sm text-white/70">Built for Rwandan businesses · Prices in RWF · MTN Mobile Money</p>
        </div>
      </div>
    </div>
  );
}
