"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Smartphone, XCircle, Banknote } from "lucide-react";

type Status = { paymentStatus: string; failureReason: string | null; orderPaymentStatus?: string; orderStatus?: string };

export function PaymentTracker({ orderId, method, initial, payerPhone, simulator }: { orderId: string; method: string; initial: Status; payerPhone: string | null; simulator: boolean }) {
  const [s, setS] = useState<Status>(initial);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const started = useRef(Date.now());

  const paid = s.orderPaymentStatus === "PAID" || s.paymentStatus === "successful";
  const waiting = method === "MTN_MOMO" && !paid && (s.paymentStatus === "pending" || s.paymentStatus === "processing");
  const failed = method === "MTN_MOMO" && !paid && ["failed", "expired", "cancelled"].includes(s.paymentStatus);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/payments/${orderId}/status`, { cache: "no-store" });
    if (res.ok) setS(await res.json());
  }, [orderId]);

  useEffect(() => {
    if (!waiting) return;
    // Poll every 4 s for the first 3 minutes, then every 15 s.
    const t = setTimeout(poll, Date.now() - started.current < 180_000 ? 4000 : 15000);
    return () => clearTimeout(t);
  }, [waiting, poll, s]);

  async function retry() {
    setRetrying(true);
    setError(null);
    const res = await fetch(`/api/payments/${orderId}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(phone ? { phone } : {}) });
    const data = await res.json().catch(() => ({}));
    setRetrying(false);
    if (!res.ok) return setError(data.error ?? "Could not retry payment.");
    started.current = Date.now();
    setS((x) => ({ ...x, paymentStatus: data.status, failureReason: null }));
  }

  async function simulate(approve: boolean) {
    await fetch(`/api/payments/${orderId}/simulate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ approve }) });
    poll();
  }

  const box = "flex gap-4 border p-5";
  const radius = { borderRadius: "var(--sf-radius)" };

  if (method === "CASH_ON_DELIVERY") {
    return (
      <div className={`${box} border-current/15`} style={radius}>
        <Banknote className="h-6 w-6 shrink-0" />
        <div><p className="font-semibold">Order received</p><p className="text-sm opacity-75">Pay when your order is delivered. The store will contact you to arrange delivery.</p></div>
      </div>
    );
  }
  if (paid) {
    return (
      <div className={`${box} border-green-600/30 bg-green-50 text-green-900`} style={radius}>
        <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
        <div><p className="font-semibold">Payment confirmed</p><p className="text-sm">Your MoMo payment was received. The store is preparing your order.</p></div>
      </div>
    );
  }
  if (failed) {
    return (
      <div className={`${box} flex-col border-red-600/30 bg-red-50 text-red-900 @2xl:flex-row`} style={radius}>
        <XCircle className="h-6 w-6 shrink-0 text-red-600" />
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="font-semibold">{s.paymentStatus === "expired" ? "Payment request expired" : "Payment not completed"}</p>
            <p className="text-sm">{s.failureReason ?? "The payment was not approved."} Your order is saved — you can try again.</p>
          </div>
          <div className="flex flex-col gap-2 @2xl:flex-row">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={payerPhone ?? "MTN number"} className="flex-1 border border-red-300 bg-white px-3 py-2 text-sm text-zinc-900" style={radius} />
            <button onClick={retry} disabled={retrying} className="bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ borderRadius: "var(--sf-radius-btn)" }}>
              {retrying ? "Sending…" : "Try again"}
            </button>
          </div>
          {error && <p className="text-sm">{error}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className={`${box} flex-col border-amber-500/40 bg-amber-50 text-amber-950`} style={radius}>
      <div className="flex gap-4">
        <Smartphone className="h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <p className="flex items-center gap-2 font-semibold">Approve the payment on your phone <Loader2 className="h-4 w-4 animate-spin" /></p>
          <p className="text-sm">We sent a Mobile Money prompt{payerPhone ? ` to ${payerPhone}` : ""}. Enter your MoMo PIN on your phone to confirm. This page updates automatically.</p>
          <p className="mt-1 text-xs opacity-70">No prompt? Dial *182*7*1# to see pending approvals.</p>
        </div>
      </div>
      {simulator && (
        <div className="flex flex-wrap items-center gap-2 border-t border-amber-500/30 pt-3 text-xs">
          <span className="font-semibold">Dev simulator:</span>
          <button onClick={() => simulate(true)} className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white">Approve</button>
          <button onClick={() => simulate(false)} className="rounded bg-red-600 px-3 py-1.5 font-semibold text-white">Decline</button>
        </div>
      )}
    </div>
  );
}
