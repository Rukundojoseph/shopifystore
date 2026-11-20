export const FONTS = [
  "Inter", "DM Sans", "Poppins", "Montserrat", "Manrope", "Nunito",
  "Playfair Display", "Lora", "Cormorant Garamond", "Space Grotesk", "Outfit", "Work Sans",
  "Roboto", "Open Sans", "Lato", "Raleway", "Rubik", "Josefin Sans", "Archivo", "Quicksand",
  "Oswald", "Bebas Neue", "Fraunces", "Merriweather", "DM Serif Display",
  "Dancing Script", "Pacifico", "Caveat",
] as const;
export type FontName = (typeof FONTS)[number];

const SERIF = new Set<string>(["Playfair Display", "Lora", "Cormorant Garamond", "Fraunces", "Merriweather", "DM Serif Display"]);
const SCRIPT = new Set<string>(["Dancing Script", "Pacifico", "Caveat"]);

/** Groups for font pickers. */
export const FONT_GROUPS: { label: string; fonts: string[] }[] = [
  { label: "Sans serif", fonts: FONTS.filter((f) => !SERIF.has(f) && !SCRIPT.has(f)) },
  { label: "Serif", fonts: FONTS.filter((f) => SERIF.has(f)) },
  { label: "Handwriting", fonts: FONTS.filter((f) => SCRIPT.has(f)) },
];

export const isFont = (f: unknown): f is FontName => typeof f === "string" && (FONTS as readonly string[]).includes(f);

/** CSS font-family for a font from the list (never free text). */
export function fontStack(f: FontName): string {
  return `"${f}",${SERIF.has(f) ? "serif" : SCRIPT.has(f) ? "cursive" : "sans-serif"}`;
}

export function googleFontsHref(fonts: string[]): string | null {
  const unique = [...new Set(fonts)].filter(isFont);
  if (!unique.length) return null;
  const families = unique.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Every listed font a design uses (theme fonts and per-element `font` styles), to load them. */
export function fontsInDesign(value: unknown): FontName[] {
  const out = new Set<FontName>();
  const walk = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 40) return;
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    for (const [k, x] of Object.entries(v)) {
      if ((k === "font" || k === "headingFont") && isFont(x)) out.add(x);
      else if (typeof x === "object") walk(x, depth + 1);
    }
  };
  walk(value, 0);
  return [...out];
}
