import type { ReactNode } from "react";
import { googleFontsHref } from "@/lib/editor/fonts";
import { loadStorefront } from "@/lib/storefront/data";
import { SiteFrame } from "./site-frame";
import type { StorefrontCtx } from "./types";
import type { SiteConfig } from "@/lib/editor/schema";

/** Server wrapper used by every storefront route: loads the store and renders header/footer. */
export async function StorePage({
  storeKey,
  preview,
  children,
}: {
  storeKey: string;
  preview?: boolean;
  children: (data: { ctx: StorefrontCtx; config: SiteConfig }) => ReactNode;
}) {
  const data = await loadStorefront(storeKey, preview);
  if (data.comingSoon) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 p-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Coming soon</p>
        <h1 className="text-3xl font-bold text-zinc-900">{data.store.name}</h1>
        <p className="max-w-md text-zinc-600">This store is getting ready. Please check back soon.</p>
      </div>
    );
  }
  const { ctx, config, previewing } = data;
  const fonts = googleFontsHref([config.theme.font, config.theme.headingFont]);
  return (
    <>
      { }
      {fonts && <link rel="stylesheet" href={fonts} />}
      <SiteFrame
        ctx={ctx}
        header={config.header}
        footer={config.footer}
        banner={
          previewing || data.store.status !== "PUBLISHED" ? (
            <div className="bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-amber-950">
              Draft preview — only store members can see this.{" "}
              <a href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/store-builder/editor`} className="underline">Back to editor</a>
            </div>
          ) : null
        }
      >
        {children({ ctx, config })}
      </SiteFrame>
    </>
  );
}
