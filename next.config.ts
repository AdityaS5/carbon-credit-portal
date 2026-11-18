import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo-name>/. Override with BASE_PATH="" for a root deploy or local preview.
const basePath = process.env.BASE_PATH ?? "/carbon-credit-portal";

const config: NextConfig = {
  output: "export", // fully static: no server, no API routes, no API key
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true, // /results/ -> results/index.html, which Pages serves directly
  images: { unoptimized: true }, // no image optimisation server on Pages
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default config;
