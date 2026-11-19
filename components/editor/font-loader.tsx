"use client";
import { googleFontsHref } from "@/lib/editor/fonts";

export function FontLoader({ fonts }: { fonts: string[] }) {
  const href = googleFontsHref(fonts);
   
  return href ? <link rel="stylesheet" href={href} /> : null;
}
