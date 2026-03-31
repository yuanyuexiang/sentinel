import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用 standalone 输出用于 Docker 部署
  output: 'standalone',
  experimental: {
    // Allow large multipart folder uploads through /api/proxy rewrites.
    proxyClientMaxBodySize: "100mb",
  },

  async rewrites() {
    const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const prefix = process.env.NEXT_PUBLIC_API_PREFIX || "/consultant/api";
    const isProduction = process.env.NODE_ENV === "production";
    // In Docker/Traefik deployment, route through same-origin gateway path.
    // This prevents build-time localhost env from being baked into proxy destination.
    const baseUrl = isProduction
      ? ""
      : rawBaseUrl === undefined
        ? "http://127.0.0.1:8000"
        : rawBaseUrl.trim();
    const targetPrefix = baseUrl ? `${baseUrl}${prefix}` : prefix;

    return [
      {
        source: "/api/proxy/:path*",
        destination: `${targetPrefix}/:path*`,
      },
    ];
  },
};

export default nextConfig;
