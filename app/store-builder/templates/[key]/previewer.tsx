"use client";

import Link from "next/link";
import { useState } from "react";
import { Monitor, Smartphone, ArrowLeft } from "lucide-react";
import type { SiteConfig } from "@/lib/editor/schema";
import type { StorefrontCtx } from "@/components/storefront/types";
import { SectionList, SiteFrame } from "@/components/storefront/site-frame";
import { FontLoader } from "@/components/editor/font-loader";
import { Button, cn } from "@/components/ui";
import { applyTemplateAction } from "../../actions";

export function TemplatePreviewer({ name, templateKey, config, ctx }: { name: string; templateKey: string; config: SiteConfig; ctx: StorefrontCtx }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const home = config.pages.find((p) => p.slug === "/")!;
  return (
    <div className="flex h-screen flex-col">
      <FontLoader fonts={[config.theme.font, config.theme.headingFont]} />
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-3">
        <Link href="/store-builder/templates" className="flex items-center gap-2 text-sm font-medium"><ArrowLeft className="h-4 w-4" /> Templates</Link>
        <p className="font-semibold">{name}</p>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-lg border border-zinc-200 p-0.5 sm:flex">
            {(["desktop", "mobile"] as const).map((d) => (
              <button key={d} onClick={() => setDevice(d)} className={cn("rounded-md p-1.5", device === d && "bg-zinc-900 text-white")} aria-label={d}>{d === "desktop" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}</button>
            ))}
          </div>
          <form action={applyTemplateAction}><input type="hidden" name="template" value={templateKey} /><Button size="sm">Use this template</Button></form>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto bg-zinc-200 p-4">
        <div className={cn("mx-auto overflow-hidden bg-white shadow-xl transition-all", device === "mobile" ? "w-[390px] rounded-[28px] border-8 border-zinc-900" : "w-full max-w-[1400px] rounded-lg")} onClickCapture={(e) => e.preventDefault()}>
          <SiteFrame ctx={ctx} header={config.header} footer={config.footer}>
            <SectionList sections={home.sections} ctx={ctx} />
          </SiteFrame>
        </div>
      </div>
    </div>
  );
}
