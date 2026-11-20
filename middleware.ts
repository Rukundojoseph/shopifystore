import { NextResponse, type NextRequest } from "next/server";
import { STORE_HOST_APP_PATHS, storeKeyFromHost } from "@/lib/tenants/host";

// Multi-tenant routing:
//   <slug>.<root domain>/dashboard/...  → store owner dashboard, locked to that store
//   <slug>.<root domain>/...            → /s/<slug>/...
//   <custom domain>/...                 → /s/<hostname>/...  (resolved via store_domains)
//   <root domain>/s/<slug>/...          → served as-is (preview / no-DNS fallback)

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const storeKey = storeKeyFromHost(req.headers.get("host"));

  if (!storeKey) return NextResponse.next();

  // The owner dashboard, editor and sign-in pages are served on the store's
  // own domain too. requireStore() pins them to this host's store.
  if (STORE_HOST_APP_PATHS.test(url.pathname)) return NextResponse.next();

  // Other platform-only areas are never served from a store domain.
  if (/^\/(admin|onboarding|register|verify-email|s\/)/.test(url.pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = new Headers(req.headers);
  headers.set("x-sh-store-host", "1");
  const rewritten = url.clone();
  rewritten.pathname = `/s/${encodeURIComponent(storeKey)}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(rewritten, { request: { headers } });
}

export const config = {
  // Skip Next internals, API routes and static files.
  matcher: ["/((?!api/|_next/|uploads/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt)$).*)", "/robots.txt", "/sitemap.xml"],
};
