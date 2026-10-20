import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We don't use next/image; keep the optimizer (and its sharp dependency) out of the picture.
  images: { unoptimized: true },
  poweredByHeader: false,
  // Pin tracing to this folder even if a lockfile exists further up the tree.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
