import { NextResponse, type NextRequest } from "next/server";

// Multi-tenant routing:
//   <slug>.<root domain>/...      → /s/<slug>/...
//   <custom domain>/...           → /s/<hostname>/...  (resolved via store_domains)
//   <root domain>/s/<slug>/...    → served as-is (preview / no-DNS fallback)

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000").toLowerCase();
const ROOT_HOST = ROOT.split(":")[0];
const PLATFORM_SUBDOMAINS = new Set(["www", "app", "admin"]);

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const hostname = host.split(":")[0];
  const url = req.nextUrl;

  let storeKey: string | null = null;
  if (hostname === ROOT_HOST || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app")) {
    storeKey = null; // platform
  } else if (hostname.endsWith(`.${ROOT_HOST}`)) {
    const sub = hostname.slice(0, -(ROOT_HOST.length + 1));
    if (!sub.includes(".") && !PLATFORM_SUBDOMAINS.has(sub)) storeKey = sub;
  } else if (hostname) {
    storeKey = hostname; // custom domain
  }

  if (!storeKey) return NextResponse.next();

  // Platform-only areas are never served from a store domain.
  if (/^\/(dashboard|admin|onboarding|store-builder|login|register|reset-password|verify-email|s\/)/.test(url.pathname)) {
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
