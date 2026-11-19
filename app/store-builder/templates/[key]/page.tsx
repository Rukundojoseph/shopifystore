import { notFound } from "next/navigation";
import { requireStore } from "@/lib/tenants";
import { TEMPLATE_MAP, buildSiteConfig } from "@/templates";
import { demoCtx } from "@/lib/editor/demo";
import { TemplatePreviewer } from "./previewer";

export default async function TemplatePreviewPage({ params }: { params: Promise<{ key: string }> }) {
  const { store } = await requireStore("store.design");
  const { key } = await params;
  const t = TEMPLATE_MAP[key];
  if (!t) notFound();
  return <TemplatePreviewer name={t.name} templateKey={t.key} config={buildSiteConfig(t.key, store.name, store.description)} ctx={demoCtx(t, { name: store.name })} />;
}
