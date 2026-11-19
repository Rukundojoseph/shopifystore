import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
export const metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 mt-1 text-sm text-zinc-500">Sign in to manage your store.</p>
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-zinc-500">New to StoreHub? <Link href="/register" className="font-medium text-brand-700 hover:underline">Create a free store</Link></p>
    </>
  );
}
