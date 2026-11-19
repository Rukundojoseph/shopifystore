"use client";

import type { ReactNode } from "react";
import type { Section } from "@/lib/editor/schema";
import { RenderSection } from "./sections";
import { themeVars } from "./theme";
import type { StorefrontCtx } from "./types";

export function SiteFrame({ ctx, header, footer, children, banner }: { ctx: StorefrontCtx; header: Section; footer: Section; children: ReactNode; banner?: ReactNode }) {
  return (
    <div style={themeVars(ctx.theme)} className="@container flex min-h-screen flex-col">
      {banner}
      <RenderSection section={header} ctx={ctx} />
      <main className="flex-1">{children}</main>
      <RenderSection section={footer} ctx={ctx} />
    </div>
  );
}

export function SectionList({ sections, ctx }: { sections: Section[]; ctx: StorefrontCtx }) {
  return (
    <>
      {sections.map((s) => (
        <RenderSection key={s.id} section={s} ctx={ctx} />
      ))}
    </>
  );
}
