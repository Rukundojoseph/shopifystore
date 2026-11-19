import "server-only";
import { db } from "@/lib/db";

export async function getStorePlan(storeId: string) {
  const sub = await db.subscription.findFirst({
    where: { storeId, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  if (sub) return { subscription: sub, plan: sub.plan };
  const starter = await db.subscriptionPlan.findUnique({ where: { key: "starter" } });
  return { subscription: null, plan: starter };
}

export async function assertCanAddProduct(storeId: string) {
  const { plan } = await getStorePlan(storeId);
  if (!plan?.maxProducts) return;
  const count = await db.product.count({ where: { storeId } });
  if (count >= plan.maxProducts) {
    throw new Error(`Your ${plan.name} plan allows ${plan.maxProducts} products. Upgrade to add more.`);
  }
}
