import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We don't use next/image; keep the optimizer (and its sharp dependency) out of the picture.
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
