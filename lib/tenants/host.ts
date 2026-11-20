// Edge-safe (used by middleware) — no server-only imports here.

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000").toLowerCase();
export const ROOT_HOST = ROOT.split(":")[0];
const PLATFORM_SUBDOMAINS = new Set(["www", "app", "admin"]);

/**
 * Maps a Host header to the store it serves:
 *   <slug>.<root domain>  → "<slug>"
 *   <custom domain>       → "<hostname>" (resolved via store_domains)
 *   platform host         → null
 */
export function storeKeyFromHost(host: string | null | undefined): string | null {
  const hostname = (host || "").toLowerCase().split(":")[0];
  if (!hostname || hostname === ROOT_HOST || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app")) return null;
  if (hostname.endsWith(`.${ROOT_HOST}`)) {
    const sub = hostname.slice(0, -(ROOT_HOST.length + 1));
    return !sub.includes(".") && !PLATFORM_SUBDOMAINS.has(sub) ? sub : null;
  }
  return hostname; // custom domain
}

/**
 * Cookie domain that lets one sign-in on the platform also work on every
 * <slug>.<root domain> dashboard. Undefined for localhost/IPs, where browsers
 * won't share cookies across subdomains — owners sign in on the subdomain there.
 */
export function sharedCookieDomain(): string | undefined {
  if (!ROOT_HOST.includes(".") || /^[\d.]+$/.test(ROOT_HOST)) return undefined;
  return `.${ROOT_HOST}`;
}

/** Paths served by the platform app even on a store's own domain. */
export const STORE_HOST_APP_PATHS = /^\/(dashboard|store-builder|login|forgot-password|reset-password)(\/|$)/;
