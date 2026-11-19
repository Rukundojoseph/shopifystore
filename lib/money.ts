// RWF has no minor unit in practice, so amounts are stored as whole francs (integers).
export const DEFAULT_CURRENCY = "RWF";

export function formatMoney(amount: number, currency = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "RWF" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** Delivery fee for a subtotal under the store's rules. */
export function deliveryFeeFor(
  subtotal: number,
  rules: { deliveryFee: number; freeDeliveryOver: number | null },
): number {
  if (rules.freeDeliveryOver != null && subtotal >= rules.freeDeliveryOver) return 0;
  return Math.max(0, rules.deliveryFee);
}

export function parseAmount(input: FormDataEntryValue | null | undefined): number | null {
  if (input == null || input === "") return null;
  const n = Number(String(input).replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
