export const FONTS = [
  "Inter", "DM Sans", "Poppins", "Montserrat", "Manrope", "Nunito",
  "Playfair Display", "Lora", "Cormorant Garamond", "Space Grotesk", "Outfit", "Work Sans",
] as const;

export function googleFontsHref(fonts: string[]): string | null {
  const unique = [...new Set(fonts)].filter((f) => (FONTS as readonly string[]).includes(f));
  if (!unique.length) return null;
  const families = unique.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
