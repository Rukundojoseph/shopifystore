import { z } from "zod";

// The website layout is persisted as this JSON document (Store.draftConfig /
// Store.publishedConfig). It is validated on every save because it is user input.

const scalar = z.union([z.string().max(5000), z.number().finite(), z.boolean(), z.null()]);
const listItem = z.record(z.string().max(40), z.union([z.string().max(2000), z.number().finite(), z.boolean()]));
const settingValue = z.union([scalar, z.array(listItem).max(50)]);

export const sectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  type: z.string().regex(/^[a-z-]{1,40}$/),
  hidden: z.boolean().optional(),
  settings: z.record(z.string().max(40), settingValue),
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const themeSchema = z.object({
  primaryColor: hex,
  secondaryColor: hex,
  backgroundColor: hex,
  textColor: hex,
  font: z.string().max(60),
  headingFont: z.string().max(60),
  radius: z.enum(["none", "sm", "md", "lg", "full"]),
});

export const pageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: z.string().min(1).max(60),
  slug: z.string().regex(/^\/[a-z0-9-]{0,40}$/),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(300).optional(),
  sections: z.array(sectionSchema).max(60),
});

export const siteConfigSchema = z.object({
  version: z.literal(1),
  template: z.string().max(40),
  theme: themeSchema,
  seo: z.object({
    title: z.string().max(120).optional(),
    description: z.string().max(300).optional(),
    image: z.string().max(1000).optional(),
    noindex: z.boolean().optional(),
  }),
  header: sectionSchema,
  footer: sectionSchema,
  pages: z.array(pageSchema).min(1).max(20),
});

export type Section = z.infer<typeof sectionSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type SitePage = z.infer<typeof pageSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type SettingValue = z.infer<typeof settingValue>;
export type ListItem = z.infer<typeof listItem>;

/** Only http(s), mailto:, tel: and site-relative links are rendered. */
export function safeHref(href: unknown, fallback = "#"): string {
  if (typeof href !== "string" || !href.trim()) return fallback;
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (h.startsWith("#")) return h;
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  return fallback;
}

export function safeImage(src: unknown): string | null {
  if (typeof src !== "string" || !src.trim()) return null;
  const s = src.trim();
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https:\/\//i.test(s)) return s;
  return null;
}
