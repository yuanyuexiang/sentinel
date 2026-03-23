import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
    const prefix = process.env.NEXT_PUBLIC_API_PREFIX || "/consultant/api";

    return [
      {
        source: "/api/proxy/:path*",
        destination: `${baseUrl}${prefix}/:path*`,
      },
    ];
  },
};

export default nextConfig;
