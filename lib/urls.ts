const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Public URL of a store on its platform subdomain. */
export function storeUrl(slug: string, path = ""): string {
  const proto = APP.startsWith("https") ? "https" : "http";
  return `${proto}://${slug}.${ROOT}${path}`;
}

/** Same store served from the platform domain — works without wildcard DNS. */
export function storePathUrl(slug: string, path = ""): string {
  return `/s/${slug}${path}`;
}

export const ROOT_DOMAIN = ROOT;
