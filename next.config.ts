import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The whole app is auth-gated and request-scoped, so component-level
  // caching buys us nothing and only complicates cookie access.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
