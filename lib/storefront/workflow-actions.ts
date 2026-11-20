"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/tenants/permissions";
import { siteConfigSchema, STAFF_ACTIONS, type WorkflowAction } from "@/lib/editor/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import { applyOrderStatus, deleteOrder } from "@/lib/orders/status";

type Result = { ok?: true; message?: string; error?: string; denied?: true };

/**
 * Runs one staff-only workflow step (cancel / change status / delete an order).
 *
 * Never trusts the browser's copy of the workflow: the step is looked up by id
 * in the store's own saved design, and the caller must be a signed-in member
 * of that store with permission to update orders. Visitors get `denied` and
 * the storefront silently does nothing.
 */
export async function runStaffActionAction(input: { storeId: string; workflowId: string; actionId: string; values: Record<string, string> }): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { denied: true };
  const storeId = String(input?.storeId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(storeId) || !/^[a-z0-9-]{1,64}$/.test(String(input.workflowId)) || !/^[a-z0-9-]{1,64}$/.test(String(input.actionId))) return { denied: true };
  if (!rateLimit(`staffwf:${user.id}`, 30, 60_000).ok) return { error: "Too many actions — wait a minute." };

  const member = await db.storeMember.findFirst({ where: { storeId, userId: user.id } });
  if (!member || !can(member.role, "orders.update")) return { denied: true };
  const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true, publishedConfig: true, draftConfig: true } });
  if (!store) return { denied: true };

  // Published design first; members may also be testing the draft preview.
  let action: WorkflowAction | undefined;
  for (const raw of [store.publishedConfig, store.draftConfig]) {
    const parsed = siteConfigSchema.safeParse(raw);
    const wf = parsed.success ? parsed.data.workflows?.find((w) => w.id === input.workflowId && !w.disabled) : undefined;
    action = wf?.actions.find((a) => a.id === input.actionId);
    if (action) break;
  }
  if (!action || !STAFF_ACTIONS.has(action.type) || !("orderField" in action || "orderNumber" in action)) return { denied: true };

  const a = action as Extract<WorkflowAction, { type: "cancelOrder" | "setOrderStatus" | "deleteOrder" }>;
  const raw = a.orderField ? String(input.values?.[a.orderField] ?? "") : String(a.orderNumber ?? "");
  const number = Number(raw.replace(/^#/, "").trim());
  if (!Number.isInteger(number) || number < 1) return { error: "Enter a valid order number" };
  const order = await db.order.findFirst({ where: { storeId, number }, select: { id: true, number: true } });
  if (!order) return { error: `Order #${number} was not found` };

  const res =
    a.type === "deleteOrder" ? await deleteOrder(storeId, user.id, order.id)
    : await applyOrderStatus(storeId, user.id, order.id, a.type === "cancelOrder" ? "CANCELLED" : a.status);
  if (!res.ok) return { error: res.error };
  return { ok: true, message: a.type === "deleteOrder" ? `Order #${order.number} deleted` : a.type === "cancelOrder" ? `Order #${order.number} cancelled` : `Order #${order.number} updated` };
}
