"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { consumeToken, issueToken } from "@/lib/auth/tokens";
import { appUrl, sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/ui/form-message";

const password = z.string().min(8, "Use at least 8 characters").max(200);

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

async function sendVerification(userId: string, email: string) {
  const token = await issueToken(userId, "EMAIL_VERIFICATION", 60 * 24);
  await sendMail(email, "Verify your StoreHub email", `Confirm your email address:\n${appUrl(`/verify-email?token=${token}`)}`);
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 5, 15 * 60_000).ok) return { error: "Too many sign-up attempts. Try again later." };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter your name").max(120),
      email: z.string().trim().toLowerCase().email("Enter a valid email"),
      password,
      consent: z.literal("on", { errorMap: () => ({ message: "You must accept the terms and privacy policy" }) }),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please fix the errors below.", fieldErrors: fieldErrors(parsed.error) };
  const { name, email } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists.", fieldErrors: { email: "Already registered — sign in instead" } };
  const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(parsed.data.password) } });
  await audit({ action: "user.register", userId: user.id, ip, metadata: { consentAt: new Date().toISOString() } });
  await sendVerification(user.id, email);
  await createSession(user.id);
  redirect("/onboarding");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000).ok || !rateLimit(`login:${email}`, 8, 15 * 60_000).ok) {
    return { error: "Too many attempts. Please wait 15 minutes." };
  }
  const user = await db.user.findUnique({ where: { email } });
  const ok = user && (await verifyPassword(String(form.get("password") ?? ""), user.passwordHash));
  if (!user || !ok) return { error: "Incorrect email or password." };
  if (user.status !== "ACTIVE") return { error: "This account has been suspended. Contact support." };
  await createSession(user.id);
  await audit({ action: "user.login", userId: user.id, ip });
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : user.role === "PLATFORM_ADMIN" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!rateLimit(`forgot:${ip}`, 5, 15 * 60_000).ok) return { error: "Too many requests. Try again later." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status === "ACTIVE") {
    const token = await issueToken(user.id, "PASSWORD_RESET", 60);
    await sendMail(email, "Reset your StoreHub password", `Reset your password (valid for 1 hour):\n${appUrl(`/reset-password?token=${token}`)}`);
  }
  // Same response whether or not the account exists.
  return { success: "If an account exists for that email, we've sent a reset link." };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ token: z.string().min(10), password, confirm: z.string() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please fix the errors below.", fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.password !== parsed.data.confirm) return { error: "Passwords do not match.", fieldErrors: { confirm: "Passwords do not match" } };
  const userId = await consumeToken(parsed.data.token, "PASSWORD_RESET");
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await audit({ action: "user.password_reset", userId });
  await createSession(userId);
  redirect("/dashboard");
}

export async function resendVerificationAction() {
  const user = await getCurrentUser();
  if (!user || user.emailVerifiedAt) return;
  if (!rateLimit(`verify:${user.id}`, 3, 60 * 60_000).ok) return;
  await sendVerification(user.id, user.email);
}
