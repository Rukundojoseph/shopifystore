/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Smartphone, Banknote, Loader2 } from "lucide-react";
import { useCart } from "@/components/storefront/cart";
import { contrastText } from "@/components/storefront/theme";
import { deliveryFeeFor, formatMoney } from "@/lib/money";
import { RWANDA_DISTRICTS } from "@/lib/rwanda";

type Props = {
  storeId: string;
  currency: string;
  deliveryFee: number;
  freeDeliveryOver: number | null;
  methods: { momo: boolean; cod: boolean };
  momoMode: "live" | "simulator" | "off";
  orderBase: string;
  cartHref: string;
  primaryColor: string;
};

const input = "w-full border border-current/20 bg-white px-3 py-3 text-base text-zinc-900 outline-none focus:border-[var(--sf-primary)] @2xl:text-sm";

export function CheckoutForm(p: Props) {
  const cart = useCart();
  const router = useRouter();
  const [method, setMethod] = useState<"MTN_MOMO" | "CASH_ON_DELIVERY">(p.methods.momo ? "MTN_MOMO" : "CASH_ON_DELIVERY");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [samePhone, setSamePhone] = useState(true);

  if (!cart.ready) return <div className="min-h-[50vh]" />;
  if (!cart.lines.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="mb-4">Your cart is empty.</p>
        <Link href={p.cartHref} className="underline">Back to cart</Link>
      </div>
    );
  }

  const delivery = deliveryFeeFor(cart.subtotal, p);
  const total = cart.subtotal + delivery;
  const noMethods = !p.methods.momo && !p.methods.cod;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    const f = new FormData(e.currentTarget);
    const phone = String(f.get("phone") ?? "");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeId: p.storeId,
          items: cart.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
          customer: {
            name: f.get("name"),
            phone,
            email: f.get("email") || undefined,
            address: f.get("address"),
            district: f.get("district"),
            notes: f.get("notes") || undefined,
          },
          paymentMethod: method,
          momoPhone: method === "MTN_MOMO" ? (samePhone ? phone : String(f.get("momoPhone") ?? "")) : undefined,
          expectedTotal: total,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We could not place your order.");
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        setSubmitting(false);
        return;
      }
      cart.clear();
      router.push(`${p.orderBase}/${data.orderId}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  const fe = (k: string) => (fieldErrors[k] ? <p className="mt-1 text-xs text-red-600">{fieldErrors[k]}</p> : null);

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-10 px-4 py-8 @2xl:px-6 @2xl:py-12 @5xl:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-8">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--sf-heading)" }}>Checkout</h1>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-lg font-semibold">Your details</legend>
          <label className="text-sm">Full name<input name="name" required autoComplete="name" className={input} style={{ borderRadius: "var(--sf-radius)" }} />{fe("name")}</label>
          <label className="text-sm">Phone number<input name="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="078 123 4567" className={input} style={{ borderRadius: "var(--sf-radius)" }} />{fe("phone")}</label>
          <label className="text-sm">Email <span className="opacity-60">(optional)</span><input name="email" type="email" autoComplete="email" className={input} style={{ borderRadius: "var(--sf-radius)" }} />{fe("email")}</label>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-lg font-semibold">Delivery</legend>
          <label className="text-sm">District / city
            <select name="district" required defaultValue="" className={input} style={{ borderRadius: "var(--sf-radius)" }}>
              <option value="" disabled>Select district</option>
              {RWANDA_DISTRICTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            {fe("district")}
          </label>
          <label className="text-sm">Delivery address<textarea name="address" required rows={2} placeholder="Sector, street, house number or landmark" className={input} style={{ borderRadius: "var(--sf-radius)" }} />{fe("address")}</label>
          <label className="text-sm">Order notes <span className="opacity-60">(optional)</span><textarea name="notes" rows={2} className={input} style={{ borderRadius: "var(--sf-radius)" }} /></label>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold">Payment</legend>
          {noMethods && <p className="text-sm text-red-600">This store is not accepting orders right now.</p>}
          {p.methods.momo && (
            <label className={`flex cursor-pointer items-start gap-3 border p-4 ${method === "MTN_MOMO" ? "border-[var(--sf-primary)]" : "border-current/15"}`} style={{ borderRadius: "var(--sf-radius)" }}>
              <input type="radio" name="method" checked={method === "MTN_MOMO"} onChange={() => setMethod("MTN_MOMO")} className="mt-1" />
              <div className="flex-1">
                <p className="flex items-center gap-2 font-medium"><Smartphone className="h-4 w-4" /> MTN Mobile Money</p>
                <p className="text-sm opacity-70">You will receive a prompt on your phone to approve the payment.</p>
                {p.momoMode === "simulator" && <p className="mt-1 text-xs font-medium text-amber-700">Test mode: no real money is charged.</p>}
                {method === "MTN_MOMO" && (
                  <div className="mt-3 flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={samePhone} onChange={(e) => setSamePhone(e.target.checked)} /> Pay with the phone number above</label>
                    {!samePhone && <input name="momoPhone" type="tel" required placeholder="MoMo number, e.g. 078 123 4567" className={input} style={{ borderRadius: "var(--sf-radius)" }} />}
                    {fe("momoPhone")}
                  </div>
                )}
              </div>
            </label>
          )}
          {p.methods.cod && (
            <label className={`flex cursor-pointer items-start gap-3 border p-4 ${method === "CASH_ON_DELIVERY" ? "border-[var(--sf-primary)]" : "border-current/15"}`} style={{ borderRadius: "var(--sf-radius)" }}>
              <input type="radio" name="method" checked={method === "CASH_ON_DELIVERY"} onChange={() => setMethod("CASH_ON_DELIVERY")} className="mt-1" />
              <div>
                <p className="flex items-center gap-2 font-medium"><Banknote className="h-4 w-4" /> Pay on delivery</p>
                <p className="text-sm opacity-70">Pay with cash or MoMo when your order arrives.</p>
              </div>
            </label>
          )}
        </fieldset>
      </div>

      <aside className="h-fit border border-current/10 p-6 @5xl:sticky @5xl:top-24" style={{ borderRadius: "var(--sf-radius)" }}>
        <h2 className="mb-4 font-semibold">Order summary</h2>
        <ul className="flex flex-col gap-3">
          {cart.lines.map((l) => (
            <li key={l.productId + (l.variantId ?? "")} className="flex items-center gap-3 text-sm">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-black/5" style={{ borderRadius: "var(--sf-radius)" }}>
                {l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}
                <span className="absolute right-0 top-0 rounded-bl bg-black/70 px-1.5 text-[11px] text-white">{l.quantity}</span>
              </div>
              <div className="flex-1"><p className="font-medium">{l.name}</p>{l.variantName && <p className="text-xs opacity-60">{l.variantName}</p>}</div>
              <span>{formatMoney(l.price * l.quantity, p.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-6 flex flex-col gap-2 border-t border-current/10 pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(cart.subtotal, p.currency)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{delivery === 0 ? "Free" : formatMoney(delivery, p.currency)}</dd></div>
          <div className="flex justify-between border-t border-current/10 pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(total, p.currency)}</dd></div>
        </dl>
        {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          disabled={submitting || noMethods}
          className="mt-6 flex w-full items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--sf-primary)", color: contrastText(p.primaryColor), borderRadius: "var(--sf-radius-btn)" }}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {method === "MTN_MOMO" ? `Pay ${formatMoney(total, p.currency)} with MoMo` : "Place order"}
        </button>
        <p className="mt-3 text-center text-xs opacity-60">By placing your order you agree to the store&apos;s terms and privacy policy.</p>
      </aside>
    </form>
  );
}
