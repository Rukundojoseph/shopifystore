import Link from "next/link";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/auth/tokens";
export const metadata = { title: "Verify email" };
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const userId = token ? await consumeToken(token, "EMAIL_VERIFICATION") : null;
  if (userId) await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{userId ? "Email verified" : "Link invalid or expired"}</h1>
      <p className="mb-8 mt-2 text-sm text-zinc-500">{userId ? "Thanks — your email address is confirmed." : "Sign in and request a new verification email from your dashboard."}</p>
      <Link href="/dashboard" className="text-sm font-medium text-brand-700 hover:underline">Go to dashboard →</Link>
    </>
  );
}
