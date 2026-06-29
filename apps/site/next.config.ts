import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw .ts/.tsx source (no build step) — Next must
  // transpile them. Add a package here whenever a new @repo/* dep is consumed.
  transpilePackages: ["@repo/ui", "@repo/core", "@repo/api-client"],
};

export default nextConfig;
