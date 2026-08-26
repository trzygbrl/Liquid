import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Demo imagery only: stand-in portraits for the seeded doctor roster. Swap
    // these for self-hosted assets before any real deployment. The marketing
    // photography is already self-hosted under /public/home.
    remotePatterns: [
      { protocol: "https", hostname: "randomuser.me" },
    ],
  },
};

export default nextConfig;
