// Custom Tailwind classes (Advanced tab). Stored as a plain class list on an
// element or section; the CSS for them is generated on the server by the real
// Tailwind compiler (lib/storefront/tailwind-css.ts) — never raw CSS from the
// merchant. Tokens are limited to the characters Tailwind class names use and
// may not load anything (no url()), so a class can only style its element.

export const MAX_TW_LENGTH = 600;
export const MAX_TW_CLASSES = 60;

const TOKEN = /^[A-Za-z0-9_:/.[\]#%(),!@&>*+'=~-]{1,120}$/;

export function isTwToken(t: string): boolean {
  return TOKEN.test(t) && !/url\(|image-set\(|@import|expression\(/i.test(t);
}

/** Valid class names from a merchant's string (invalid ones are dropped). */
export function twClasses(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return [...new Set(raw.trim().split(/\s+/).filter(isTwToken))].slice(0, MAX_TW_CLASSES);
}

/** The tokens that would be dropped, for a warning under the input. */
export function invalidTwTokens(raw: string): string[] {
  return raw.trim().split(/\s+/).filter((t) => t && !isTwToken(t));
}

/** Every custom class a design uses (elements and sections), to build its CSS. */
export function twInDesign(value: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 40) return;
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    for (const [k, x] of Object.entries(v)) {
      if (k === "tw") twClasses(x).forEach((c) => out.add(c));
      else if (typeof x === "object") walk(x, depth + 1);
    }
  };
  walk(value, 0);
  return [...out].sort().slice(0, 2000);
}
