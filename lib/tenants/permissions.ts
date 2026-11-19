import type { StoreRole } from "@prisma/client";

export type Permission =
  | "store.settings"
  | "store.design"
  | "store.publish"
  | "products.manage"
  | "orders.view"
  | "orders.update"
  | "customers.view"
  | "payments.view"
  | "billing.manage";

const MATRIX: Record<StoreRole, Permission[]> = {
  OWNER: [
    "store.settings", "store.design", "store.publish", "products.manage", "orders.view",
    "orders.update", "customers.view", "payments.view", "billing.manage",
  ],
  MANAGER: ["store.design", "products.manage", "orders.view", "orders.update", "customers.view", "payments.view"],
  STAFF: ["orders.view", "orders.update"],
};

export function can(role: StoreRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}
