import type { NextConfig } from "next";
import { buildSecurityHeaders, JOIN_PAGE_HEADERS } from "./src/config/security-headers.ts";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Mặc định của create-next-app 16.4; cả hai sẽ được bật cố định ở bản major tiếp theo.
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: buildSecurityHeaders({ isDev }) },
      // Khai báo sau nên ghi đè Referrer-Policy chung cho riêng /join.
      { source: "/join", headers: JOIN_PAGE_HEADERS },
    ];
  },
};

export default nextConfig;
