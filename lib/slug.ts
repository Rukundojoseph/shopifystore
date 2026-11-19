export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Subdomains that must never be claimed by a store.
export const RESERVED_SLUGS = new Set([
  "www", "app", "admin", "api", "dashboard", "mail", "help", "support", "docs",
  "blog", "status", "static", "cdn", "assets", "store", "stores", "login", "register",
]);

export function isValidStoreSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !RESERVED_SLUGS.has(slug);
}
