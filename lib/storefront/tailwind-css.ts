import "server-only";
import { compile } from "@tailwindcss/node";
import { twClasses } from "@/lib/editor/tailwind";

// Builds CSS for the custom Tailwind classes merchants add in the editor's
// Advanced tab, with the real Tailwind compiler. Utilities are `!important`
// so they win over the panel's own settings (the merchant typed them on
// purpose); theme variables are scoped to the store root (.sf-tw) so they
// can't restyle the editor around the canvas. Store colours and fonts are
// available as primary / secondary / store-bg / store-text and
// font-heading / font-body.

const INPUT = `@import "tailwindcss/theme" layer(theme);
@import "tailwindcss/utilities" layer(utilities) important;
@theme inline {
  --color-primary: var(--sf-primary);
  --color-secondary: var(--sf-secondary);
  --color-store-bg: var(--sf-bg);
  --color-store-text: var(--sf-text);
  --font-heading: var(--sf-heading);
  --font-body: var(--sf-font);
}`;

let compiler: ReturnType<typeof compile> | null = null;
const cache = new Map<string, string>();

export async function tailwindCss(classes: string[]): Promise<string> {
  const list = [...new Set(classes.flatMap((c) => twClasses(c)))].sort();
  if (!list.length) return "";
  const key = list.join(" ");
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  try {
    compiler ??= compile(INPUT, { base: process.cwd(), onDependency() {} });
    const css = (await compiler).build(list)
      .replace(/:root,\s*:host/g, ".sf-tw")
      .replace(/<\/style/gi, "<\\/style");
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    cache.set(key, css);
    return css;
  } catch (e) {
    compiler = null;
    console.error("[tailwind] could not build custom classes", e);
    return "";
  }
}
