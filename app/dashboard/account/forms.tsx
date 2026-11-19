"use client";
import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { changePasswordAction, saveProfileAction } from "./actions";

export function ProfileForm({ name, phone, email }: { name: string; phone: string | null; email: string }) {
  const [state, action] = useActionState(saveProfileAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4 p-5">
      <FormMessage state={state} />
      <Field label="Email"><Input value={email} disabled /></Field>
      <Field label="Name"><Input name="name" defaultValue={name} required /></Field>
      <Field label="Phone"><Input name="phone" defaultValue={phone ?? ""} /></Field>
      <div><SubmitButton>Save profile</SubmitButton></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4 p-5">
      <FormMessage state={state} />
      <Field label="Current password"><Input name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="New password"><Input name="next" type="password" autoComplete="new-password" minLength={8} required /></Field>
      <div><SubmitButton>Change password</SubmitButton></div>
    </form>
  );
}
