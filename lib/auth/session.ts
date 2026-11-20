import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sharedCookieDomain } from "@/lib/tenants/host";

const COOKIE = "sh_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    ...(await cookieDomain()),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/**
 * Platform and <slug>.<root domain> share the session cookie, so an owner who
 * signs in once can open their store's dashboard on its subdomain. Custom
 * domains (and localhost) get a host-only cookie.
 */
async function cookieDomain(): Promise<{ domain?: string }> {
  const domain = sharedCookieDomain();
  if (!domain) return {};
  const host = ((await headers()).get("host") || "").toLowerCase().split(":")[0];
  const onRoot = host === domain.slice(1) || host.endsWith(domain);
  return onRoot ? { domain } : {};
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete({ name: COOKIE, path: "/", ...(await cookieDomain()) });
  jar.delete(COOKIE); // legacy host-only cookie
}

async function readSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

/** Current user, re-checked against the database on every request (catches suspensions). */
export const getCurrentUser = cache(async () => {
  const uid = await readSessionUserId();
  if (!uid) return null;
  const user = await db.user.findUnique({
    where: { id: uid },
    select: { id: true, name: true, email: true, role: true, status: true, emailVerifiedAt: true, phone: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "PLATFORM_ADMIN") redirect("/dashboard");
  return user;
}
