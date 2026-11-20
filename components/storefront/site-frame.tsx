"use client";

import type { ReactNode } from "react";
import type { Section, SystemPageKind, Workflow } from "@/lib/editor/schema";
import { WorkflowRoot } from "./workflow-runtime";
import { defaultSystemSections } from "@/lib/editor/sections";
import { RenderSection, SystemSlotContext } from "./sections";
import { themeVars } from "./theme";
import type { StorefrontCtx } from "./types";

export function SiteFrame({ ctx, header, footer, children, banner, workflows = [], pages = [] }: {
  ctx: StorefrontCtx;
  header: Section;
  footer: Section;
  children: ReactNode;
  banner?: ReactNode;
  workflows?: Workflow[];
  pages?: { id: string; slug: string }[];
}) {
  return (
    <WorkflowRoot ctx={ctx} workflows={workflows} pages={pages} style={themeVars(ctx.theme)} className="sf-tw @container flex min-h-screen flex-col">
      {banner}
      <RenderSection section={header} ctx={ctx} />
      <main className="flex-1">{children}</main>
      <RenderSection section={footer} ctx={ctx} />
    </WorkflowRoot>
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

/**
 * A built-in shop page (shop, product, cart…): the merchant's sections around
 * the page's own content, which the route passes as `children`.
 */
export function SystemPage({ kind, sections, ctx, children }: { kind: SystemPageKind; sections?: Section[]; ctx: StorefrontCtx; children: ReactNode }) {
  const main = `${kind}-main`;
  const list = sections?.some((s) => s.type === main) ? sections : [...(sections ?? []), ...defaultSystemSections(kind)];
  return (
    <SystemSlotContext.Provider value={children}>
      <SectionList sections={list} ctx={ctx} />
    </SystemSlotContext.Provider>
  );
}
