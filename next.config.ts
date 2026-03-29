import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用 standalone 输出用于 Docker 部署
  output: 'standalone',
  experimental: {
    // Allow large multipart folder uploads through /api/proxy rewrites.
    proxyClientMaxBodySize: "100mb",
  },

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
