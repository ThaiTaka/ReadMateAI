import type { NextConfig } from "next";
import {
  AUDIO_STUDIO_HEADERS,
  AUDIO_STUDIO_PATH,
  buildSecurityHeaders,
  JOIN_PAGE_HEADERS,
} from "./src/config/security-headers.ts";

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
      // Khai báo sau cùng nên ghi đè Permissions-Policy chung: micro chỉ mở cho trang ghi âm của giáo viên (R10.2).
      { source: AUDIO_STUDIO_PATH, headers: AUDIO_STUDIO_HEADERS },
    ];
  },
};

export default nextConfig;
