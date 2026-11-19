import Link from "next/link";
import { ForgotForm } from "@/components/auth-forms";
export const metadata = { title: "Reset password" };
export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-8 mt-1 text-sm text-zinc-500">We&apos;ll email you a link to choose a new password.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="text-brand-700 hover:underline">Back to sign in</Link></p>
    </>
  );
}
