import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Tailwind compiler (custom classes in the store editor) loads native
  // modules and its own CSS files at runtime, so it stays outside the bundle.
  serverExternalPackages: ["@tailwindcss/node", "lightningcss"],
};

export default nextConfig;
