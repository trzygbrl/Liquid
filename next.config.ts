import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Demo imagery only: editorial photography for the marketing pages and
    // stand-in portraits for the seeded doctor roster. Swap these for
    // self-hosted assets before any real deployment.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "randomuser.me" },
    ],
  },
};

export default nextConfig;
