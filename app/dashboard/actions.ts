"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { ACTIVE_STORE_COOKIE, getMemberships } from "@/lib/tenants";

export async function switchStoreAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("storeId") ?? "");
  const memberships = await getMemberships(user.id);
  if (!memberships.some((m) => m.storeId === id)) return;
  (await cookies()).set(ACTIVE_STORE_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
