import { Alert } from "./index";
export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string> } | undefined;
export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}
