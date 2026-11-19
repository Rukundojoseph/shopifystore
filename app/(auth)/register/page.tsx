import Link from "next/link";
import { RegisterForm } from "@/components/auth-forms";
export const metadata = { title: "Create your store" };
export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Start selling online</h1>
      <p className="mb-8 mt-1 text-sm text-zinc-500">Free to start. No coding needed.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-zinc-500">Already have an account? <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link></p>
    </>
  );
}
