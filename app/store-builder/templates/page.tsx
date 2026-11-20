import Link from "next/link";
import { Check } from "lucide-react";
import { requireStore } from "@/lib/tenants";
import { getStorePlan } from "@/lib/plans";
import { TEMPLATES, buildSiteConfig } from "@/templates";
import { demoCtx } from "@/lib/editor/demo";
import { FONTS } from "@/lib/editor/fonts";
import { Badge, LinkButton, Logo } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { TemplateThumb } from "@/components/editor/template-preview";
import { FontLoader } from "@/components/editor/font-loader";
import { applyTemplateAction } from "../actions";

export const metadata = { title: "Choose a template" };

const BASIC = new Set(["general", "fashion", "grocery", "blank"]);

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { store } = await requireStore("store.design");
  const { welcome } = await searchParams;
  const { plan } = await getStorePlan(store.id);
  const allTemplates = plan?.allTemplates ?? false;

  return (
    <div className="min-h-screen">
      <FontLoader fonts={[...FONTS]} />
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <Link href="/dashboard"><Logo /></Link>
        <LinkButton href="/store-builder/editor" variant="outline" size="sm">Go to editor</LinkButton>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{welcome ? `${store.name} is created! Now pick a look.` : "Choose a template"}</h1>
        <p className="mt-2 max-w-2xl text-zinc-600">Every template uses the same powerful store underneath — products, cart, MoMo checkout. Pick the style closest to your brand; you can change colours, fonts, images and sections in the editor.</p>
        {!allTemplates && <p className="mt-2 text-sm text-zinc-500">Starter plan includes 3 templates. <Link href="/dashboard/billing" className="text-brand-700 underline">Upgrade</Link> for all of them.</p>}

        <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => {
            const config = buildSiteConfig(t.key, store.name, store.description);
            const ctx = demoCtx(t, { name: store.name, description: store.description });
            const locked = !allTemplates && !BASIC.has(t.key);
            const current = store.templateKey === t.key;
            return (
              <article key={t.key} className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="relative bg-zinc-100 p-4">
                  <div className="overflow-hidden rounded-lg shadow-md ring-1 ring-black/5"><TemplateThumb config={config} ctx={ctx} device="desktop" height={240} /></div>
                  <div className="absolute bottom-2 right-3 w-[78px] overflow-hidden rounded-xl border-4 border-zinc-900 shadow-lg"><TemplateThumb config={config} ctx={ctx} device="mobile" height={150} /></div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{t.name}</h2>
                    <Badge>{t.category}</Badge>
                    {current && <Badge color="green">Current</Badge>}
                  </div>
                  <p className="text-sm text-zinc-600">{t.description}</p>
                  <ul className="flex flex-col gap-1 text-sm text-zinc-600">{t.highlights.map((h) => <li key={h} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-brand-600" />{h}</li>)}</ul>
                  <div className="mt-auto flex gap-2 pt-3">
                    <LinkButton href={`/store-builder/templates/${t.key}`} variant="outline" className="flex-1">Preview</LinkButton>
                    {locked ? (
                      <LinkButton href="/dashboard/billing" variant="secondary" className="flex-1">Upgrade to use</LinkButton>
                    ) : (
                      <form action={applyTemplateAction} className="flex-1">
                        <input type="hidden" name="template" value={t.key} />
                        <ConfirmButton message={store.templateKey && !welcome ? "Replace your current design with this template? Your products are kept; unsaved design changes will be replaced." : "Use this template?"} className="w-full">Use this template</ConfirmButton>
                      </form>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
