"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { BUSINESS_CATEGORIES } from "@/lib/categories";
import { slugify } from "@/lib/slug";
import { checkSlugAction, createStoreAction } from "./actions";

const STEPS = ["Business", "Contact", "Store address"];
const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

export function OnboardingWizard({ defaultEmail }: { defaultEmail: string }) {
  const [state, action] = useActionState(createStoreAction, undefined);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state?.fieldErrors ?? {};

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (!slug) return setSlugStatus(null);
    setChecking(true);
    const t = setTimeout(async () => {
      setSlugStatus(await checkSlugAction(slug));
      setChecking(false);
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  // Jump back to the step containing the first server-side error.
  useEffect(() => {
    if (!state?.fieldErrors) return;
    const keys = Object.keys(state.fieldErrors);
    if (keys.some((k) => ["businessName", "name", "category", "description"].includes(k))) setStep(0);
    else if (keys.some((k) => ["phone", "email", "location"].includes(k))) setStep(1);
    else setStep(2);
  }, [state]);

  function next() {
    const form = formRef.current!;
    const fields = form.querySelectorAll<HTMLInputElement>(`[data-step="${step}"] [required]`);
    for (const f of fields) if (!f.reportValidity()) return;
    setStep((s) => s + 1);
  }

  return (
    <form ref={formRef} action={action} className="mt-8">
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i < step ? "bg-brand-600 text-white" : i === step ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500")}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:inline", i === step ? "font-medium" : "text-zinc-500")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-zinc-200" />}
          </li>
        ))}
      </ol>

      <Card className="p-6">
        <div className="mb-4"><FormMessage state={state} /></div>

        <div data-step="0" className={cn("flex flex-col gap-4", step !== 0 && "hidden")}>
          <Field label="Business name" hint="Your registered or trading name" error={fe.businessName}><Input name="businessName" required placeholder="e.g. Kigali Fashion Ltd" /></Field>
          <Field label="Store name" hint="Shown to customers on your website" error={fe.name}><Input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kigali Fashion" /></Field>
          <Field label="What do you sell?" error={fe.category}>
            <Select name="category" required defaultValue="">
              <option value="" disabled>Choose a category</option>
              {BUSINESS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Short description" hint="Optional — used for your homepage and search engines" error={fe.description}><Textarea name="description" rows={3} maxLength={500} /></Field>
        </div>

        <div data-step="1" className={cn("flex flex-col gap-4", step !== 1 && "hidden")}>
          <Field label="Business phone" hint="Rwandan mobile number, e.g. 078 123 4567" error={fe.phone}><Input name="phone" type="tel" required placeholder="078 123 4567" /></Field>
          <Field label="Business email" error={fe.email}><Input name="email" type="email" required defaultValue={defaultEmail} /></Field>
          <Field label="Location" hint="District / neighbourhood" error={fe.location}><Input name="location" required placeholder="e.g. Kimironko, Gasabo, Kigali" /></Field>
          <Field label="Currency" hint="More currencies will be available when international selling launches">
            <Select name="currency" defaultValue="RWF"><option value="RWF">Rwandan franc (RWF)</option></Select>
          </Field>
        </div>

        <div data-step="2" className={cn("flex flex-col gap-4", step !== 2 && "hidden")}>
          <Field label="Store address" error={fe.slug ?? (slugStatus && !slugStatus.ok ? slugStatus.message : null)} hint={slugStatus?.ok ? <span className="text-green-700">✓ {slugStatus.message}</span> : "You can connect your own domain later"}>
            <div className="flex items-center rounded-lg border border-zinc-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
              <input
                name="slug"
                required
                value={slug}
                onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                className="h-10 min-w-0 flex-1 rounded-l-lg bg-transparent px-3 text-sm outline-none"
              />
              <span className="flex items-center gap-2 pr-3 text-sm text-zinc-500">{checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}.{ROOT.split(":")[0]}</span>
            </div>
          </Field>
          <p className="text-sm text-zinc-500">Next you&apos;ll pick a design template. Your store stays private until you publish it.</p>
        </div>

        <div className="mt-6 flex justify-between">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} className={step === 0 ? "invisible" : ""}>Back</Button>
          {step < 2 ? (
            <Button type="button" onClick={next}>Continue</Button>
          ) : (
            <SubmitButton disabled={!slugStatus?.ok} pendingText="Creating store…">Create my store</SubmitButton>
          )}
        </div>
      </Card>
    </form>
  );
}
