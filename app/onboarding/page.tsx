import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { Logo } from "@/components/ui";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Create your store" };

export default async function OnboardingPage() {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/"><Logo /></Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-800">Skip to dashboard</Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Let&apos;s set up your store, {user.name.split(" ")[0]}</h1>
        <p className="mt-2 text-zinc-500">Three quick steps. You can change everything later.</p>
        <OnboardingWizard defaultEmail={user.email} />
      </main>
    </div>
  );
}
