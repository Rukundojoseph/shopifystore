"use client";

import type { SiteConfig } from "@/lib/editor/schema";
import type { StorefrontCtx } from "@/components/storefront/types";
import { SectionList, SiteFrame } from "@/components/storefront/site-frame";
import { ScaledFrame } from "./scaled-frame";

export function TemplateThumb({ config, ctx, device, height }: { config: SiteConfig; ctx: StorefrontCtx; device: "desktop" | "mobile"; height: number }) {
  const home = config.pages.find((p) => p.slug === "/")!;
  return (
    <ScaledFrame width={device === "desktop" ? 1280 : 390} height={height} className="w-full bg-white">
      <SiteFrame ctx={ctx} header={config.header} footer={config.footer}>
        <SectionList sections={home.sections} ctx={ctx} />
      </SiteFrame>
    </ScaledFrame>
  );
}
