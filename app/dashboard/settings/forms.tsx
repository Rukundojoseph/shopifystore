"use client";

import { useActionState } from "react";
import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { addDomainAction, saveCommerceSettingsAction, saveStoreDetailsAction } from "./actions";

type Store = { name: string; businessName: string; description: string | null; phone: string | null; email: string | null; location: string | null };

export function StoreDetailsForm({ store }: { store: Store }) {
  const [state, action] = useActionState(saveStoreDetailsAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4 p-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Store name"><Input name="name" defaultValue={store.name} required /></Field>
        <Field label="Business name"><Input name="businessName" defaultValue={store.businessName} required /></Field>
        <Field label="Phone"><Input name="phone" defaultValue={store.phone ?? ""} required /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={store.email ?? ""} required /></Field>
      </div>
      <Field label="Location"><Input name="location" defaultValue={store.location ?? ""} required /></Field>
      <Field label="Description"><Textarea name="description" rows={3} defaultValue={store.description ?? ""} /></Field>
      <div><SubmitButton pendingText="Saving…">Save details</SubmitButton></div>
    </form>
  );
}

type Settings = { deliveryFee: number; freeDeliveryOver: number | null; acceptMomo: boolean; acceptCashOnDelivery: boolean };

export function CommerceForm({ settings, momoNote }: { settings: Settings; momoNote: string }) {
  const [state, action] = useActionState(saveCommerceSettingsAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-5 p-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Delivery fee (RWF)" hint="Set 0 for free delivery on every order"><Input name="deliveryFee" type="number" min={0} defaultValue={settings.deliveryFee} /></Field>
        <Field label="Free delivery on orders over (RWF)" hint="Leave empty to always charge the fee"><Input name="freeDeliveryOver" type="number" min={0} defaultValue={settings.freeDeliveryOver ?? ""} /></Field>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Payment methods</legend>
        <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm">
          <input type="checkbox" name="acceptMomo" defaultChecked={settings.acceptMomo} className="mt-0.5" />
          <span><b>MTN Mobile Money</b><br /><span className="text-zinc-500">{momoNote}</span></span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm">
          <input type="checkbox" name="acceptCashOnDelivery" defaultChecked={settings.acceptCashOnDelivery} className="mt-0.5" />
          <span><b>Pay on delivery</b><br /><span className="text-zinc-500">Customer pays cash or MoMo to your rider. Mark as collected in the order page.</span></span>
        </label>
      </fieldset>
      <div><SubmitButton pendingText="Saving…">Save</SubmitButton></div>
    </form>
  );
}

export function AddDomainForm() {
  const [state, action] = useActionState(addDomainAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 p-5">
      <FormMessage state={state} />
      <div className="flex gap-2"><Input name="domain" placeholder="www.mystore.rw" /><SubmitButton pendingText="Adding…">Connect</SubmitButton></div>
    </form>
  );
}
