import { headers } from "next/headers";
import { resolveStore } from "@/lib/tenants/resolve";
import { parseConfig } from "@/lib/storefront/data";

export async function GET(_: Request, { params }: { params: Promise<{ store: string }> }) {
  const { store: key } = await params;
  const store = await resolveStore(key);
  const noindex = !store || store.status !== "PUBLISHED" || parseConfig(store.publishedConfig, store).seo.noindex;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const sitemap = store ? (h.get("x-sh-store-host") ? `${proto}://${h.get("host")}/sitemap.xml` : `${proto}://${h.get("host")}/s/${store.slug}/sitemap.xml`) : "";
  const body = noindex ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout\nDisallow: /orders/\n\nSitemap: ${sitemap}\n`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
