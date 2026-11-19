import { db } from "@/lib/db";
import { resolveStore } from "@/lib/tenants/resolve";
import { parseConfig } from "@/lib/storefront/data";
import { headers } from "next/headers";

export async function GET(_: Request, { params }: { params: Promise<{ store: string }> }) {
  const { store: key } = await params;
  const store = await resolveStore(key);
  if (!store || store.status !== "PUBLISHED") return new Response("Not found", { status: 404 });
  const config = parseConfig(store.publishedConfig, store);
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const base = h.get("x-sh-store-host") ? `${proto}://${host}` : `${proto}://${host}/s/${store.slug}`;

  const [products, categories] = await Promise.all([
    db.product.findMany({ where: { storeId: store.id, status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ where: { storeId: store.id }, select: { slug: true } }),
  ]);
  const urls = [
    ...config.pages.map((p) => ({ loc: base + (p.slug === "/" ? "" : p.slug), lastmod: store.publishedAt })),
    { loc: `${base}/products`, lastmod: store.publishedAt },
    ...categories.map((c) => ({ loc: `${base}/collections/${c.slug}`, lastmod: null })),
    ...products.map((p) => ({ loc: `${base}/products/${p.slug}`, lastmod: p.updatedAt })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.loc.replace(/&/g, "&amp;")}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ""}</url>`)
    .join("\n")}\n</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
