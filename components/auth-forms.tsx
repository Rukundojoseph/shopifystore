"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/app/(auth)/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <div className="flex justify-end"><Link href="/forgot-password" className="text-sm text-brand-700 hover:underline">Forgot password?</Link></div>
      <SubmitButton size="lg" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <Field label="Your name" error={fe.name}><Input name="name" autoComplete="name" required /></Field>
      <Field label="Email" error={fe.email}><Input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" error={fe.password} hint="At least 8 characters"><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
      <label className="flex items-start gap-2 text-sm text-zinc-600">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        <span>I agree to the <Link href="/legal/terms" className="text-brand-700 underline">Terms</Link> and <Link href="/legal/privacy" className="text-brand-700 underline">Privacy Policy</Link>, including processing of my data under Rwanda&apos;s Law No. 058/2021.</span>
      </label>
      {fe.consent && <p className="text-xs text-red-600">{fe.consent}</p>}
      <SubmitButton size="lg" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <Field label="Email"><Input name="email" type="email" required /></Field>
      <SubmitButton size="lg" pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" error={fe.password}><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
      <Field label="Confirm password" error={fe.confirm}><Input name="confirm" type="password" autoComplete="new-password" required /></Field>
      <SubmitButton size="lg" pendingText="Saving…">Set new password</SubmitButton>
    </form>
  );
}
