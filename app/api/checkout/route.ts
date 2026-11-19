import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliveryFeeFor } from "@/lib/money";
import { isMtnNumber, normalizeRwandaPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/security/rate-limit";
import { momoAvailable, momoConfig } from "@/lib/payments/momo";
import { startOrderPayment } from "@/lib/payments/service";
import { getCurrentUser } from "@/lib/auth/session";

const bodySchema = z.object({
  storeId: z.string().uuid(),
  items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().nullable().optional(), quantity: z.number().int().min(1).max(99) })).min(1).max(50),
  customer: z.object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    phone: z.string().trim().min(9).max(20),
    email: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("").transform(() => undefined)),
    address: z.string().trim().min(4, "Enter a delivery address").max(500),
    district: z.string().trim().min(2).max(60),
    notes: z.string().trim().max(1000).optional(),
  }),
  paymentMethod: z.enum(["MTN_MOMO", "CASH_ON_DELIVERY"]),
  momoPhone: z.string().trim().max(20).optional(),
  expectedTotal: z.number().int().nonnegative().optional(),
});

class CheckoutError extends Error {
  constructor(message: string, public status = 400, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

/** Sandbox test numbers (e.g. 46733123450) are not Rwandan; accept raw digits there. */
function payerMsisdn(raw: string): string | null {
  const rw = normalizeRwandaPhone(raw);
  if (momoConfig()?.environment === "sandbox") return rw ?? (/^\d{8,15}$/.test(raw.replace(/\D/g, "")) ? raw.replace(/\D/g, "") : null);
  return rw && isMtnNumber(rw) ? rw : null;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`checkout:${ip}`, 10, 60_000).ok) return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path.at(-1))] = issue.message;
    return NextResponse.json({ error: "Please check the highlighted fields.", fieldErrors }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const store = await db.store.findUnique({ where: { id: input.storeId }, include: { settings: true } });
    if (!store || store.status === "SUSPENDED") throw new CheckoutError("Store not found", 404);
    if (store.status !== "PUBLISHED") {
      const user = await getCurrentUser();
      const member = user && (await db.storeMember.findUnique({ where: { storeId_userId: { storeId: store.id, userId: user.id } } }));
      if (!member) throw new CheckoutError("This store is not open yet.", 403);
    }

    const settings = store.settings ?? { deliveryFee: 0, freeDeliveryOver: null, acceptMomo: true, acceptCashOnDelivery: true };
    const phone = normalizeRwandaPhone(input.customer.phone);
    if (!phone) throw new CheckoutError("Please check the highlighted fields.", 400, { phone: "Enter a Rwandan mobile number, e.g. 078 123 4567" });

    let msisdn: string | null = null;
    if (input.paymentMethod === "MTN_MOMO") {
      if (!settings.acceptMomo || !momoAvailable().available) throw new CheckoutError("Mobile Money is not available for this store right now.");
      msisdn = payerMsisdn(input.momoPhone || input.customer.phone);
      if (!msisdn) throw new CheckoutError("Please check the highlighted fields.", 400, { momoPhone: "Enter an MTN number (078 or 079)", phone: input.momoPhone ? "" : "Enter an MTN number (078 or 079) to pay with MoMo" });
    } else if (!settings.acceptCashOnDelivery) {
      throw new CheckoutError("Pay on delivery is not available for this store.");
    }

    const order = await db.$transaction(async (tx) => {
      const productIds = [...new Set(input.items.map((i) => i.productId))];
      // Tenant-scoped: products from other stores simply won't be found.
      const products = await tx.product.findMany({ where: { id: { in: productIds }, storeId: store.id, status: "ACTIVE" }, include: { variants: true } });
      const byId = new Map(products.map((p) => [p.id, p]));

      const lines = input.items.map((item) => {
        const product = byId.get(item.productId);
        if (!product) throw new CheckoutError("An item in your cart is no longer available. Please review your cart.", 409);
        const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null;
        if (item.variantId && !variant) throw new CheckoutError(`${product.name}: the selected option is no longer available.`, 409);
        if (!item.variantId && product.variants.length) throw new CheckoutError(`${product.name}: please choose an option.`, 409);
        const unitPrice = variant?.price ?? product.price;
        return { product, variant, quantity: item.quantity, unitPrice, total: unitPrice * item.quantity };
      });

      const subtotal = lines.reduce((n, l) => n + l.total, 0);
      const deliveryFee = deliveryFeeFor(subtotal, settings);
      const total = subtotal + deliveryFee;
      if (input.expectedTotal != null && input.expectedTotal !== total) {
        throw new CheckoutError("Prices have changed since you added items. Please review your cart.", 409);
      }

      // Atomic stock reservation: the conditional update fails if stock ran out.
      for (const l of lines) {
        if (!l.product.trackInventory) continue;
        const res = l.variant
          ? await tx.productVariant.updateMany({ where: { id: l.variant.id, storeId: store.id, stockQuantity: { gte: l.quantity } }, data: { stockQuantity: { decrement: l.quantity } } })
          : await tx.product.updateMany({ where: { id: l.product.id, storeId: store.id, stockQuantity: { gte: l.quantity } }, data: { stockQuantity: { decrement: l.quantity } } });
        if (res.count === 0) throw new CheckoutError(`Sorry, ${l.product.name}${l.variant ? ` (${l.variant.title})` : ""} does not have enough stock.`, 409);
      }

      const { orderCounter } = await tx.store.update({ where: { id: store.id }, data: { orderCounter: { increment: 1 } }, select: { orderCounter: true } });
      const customer = await tx.customer.upsert({
        where: { storeId_phone: { storeId: store.id, phone } },
        create: { storeId: store.id, name: input.customer.name, phone, email: input.customer.email },
        update: { name: input.customer.name, ...(input.customer.email ? { email: input.customer.email } : {}) },
      });

      return tx.order.create({
        data: {
          storeId: store.id,
          customerId: customer.id,
          number: orderCounter,
          customerName: input.customer.name,
          customerPhone: phone,
          customerEmail: input.customer.email,
          address: input.customer.address,
          district: input.customer.district,
          notes: input.customer.notes,
          subtotal, deliveryFee, total,
          currency: store.currency,
          paymentMethod: input.paymentMethod,
          items: {
            create: lines.map((l) => ({
              storeId: store.id,
              productId: l.product.id,
              variantId: l.variant?.id,
              name: l.product.name,
              variantName: l.variant?.title,
              imageUrl: l.product.images[0],
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              total: l.total,
            })),
          },
        },
      });
    });

    await startOrderPayment(order, msisdn ?? phone, store.name);
    return NextResponse.json({ orderId: order.id, number: order.number });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message, fieldErrors: e.fieldErrors }, { status: e.status });
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Something went wrong placing your order. Please try again." }, { status: 500 });
  }
}
