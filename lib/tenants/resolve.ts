import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * `key` is either a store slug (from <slug>.<root domain> or /s/<slug>) or a
 * full hostname for a connected custom domain.
 */
export const resolveStore = cache(async (key: string) => {
  const k = decodeURIComponent(key).toLowerCase();
  if (k.includes(".")) {
    const domain = await db.storeDomain.findUnique({
      where: { domain: k.replace(/^www\./, "") },
      include: { store: { include: { settings: true } } },
    });
    return domain?.verifiedAt ? domain.store : null;
  }
  return db.store.findUnique({ where: { slug: k }, include: { settings: true } });
});

export type ResolvedStore = NonNullable<Awaited<ReturnType<typeof resolveStore>>>;
