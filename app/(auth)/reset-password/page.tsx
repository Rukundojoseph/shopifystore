import Link from "next/link";
import { ResetForm } from "@/components/auth-forms";
export const metadata = { title: "Choose a new password" };
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <div className="mt-8">{token ? <ResetForm token={token} /> : <p className="text-sm text-zinc-600">This link is missing its token. <Link href="/forgot-password" className="text-brand-700 underline">Request a new link</Link>.</p>}</div>
    </>
  );
}
