import type { CSSProperties } from "react";
import type { Theme } from "@/lib/editor/schema";

const RADIUS: Record<Theme["radius"], string> = { none: "0px", sm: "4px", md: "10px", lg: "18px", full: "9999px" };

export function themeVars(theme: Theme): CSSProperties {
  return {
    "--sf-primary": theme.primaryColor,
    "--sf-secondary": theme.secondaryColor,
    "--sf-bg": theme.backgroundColor,
    "--sf-text": theme.textColor,
    "--sf-on-primary": contrastText(theme.primaryColor),
    "--sf-font": `"${theme.font}", ui-sans-serif, system-ui, sans-serif`,
    "--sf-heading": `"${theme.headingFont}", ui-sans-serif, system-ui, sans-serif`,
    "--sf-radius": RADIUS[theme.radius] ?? "10px",
    "--sf-radius-btn": theme.radius === "full" ? "9999px" : RADIUS[theme.radius] ?? "10px",
    background: theme.backgroundColor,
    color: theme.textColor,
    fontFamily: "var(--sf-font)",
  } as CSSProperties;
}

export const PAD: Record<string, string> = { none: "py-0", sm: "py-6", md: "py-10 @3xl:py-14", lg: "py-14 @3xl:py-20" };

/** Picks black or white text for a background colour. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
}
