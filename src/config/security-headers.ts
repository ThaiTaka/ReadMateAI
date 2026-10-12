/**
 * Tiêu đề HTTP bảo mật dùng chung cho mọi route.
 *
 * Module này được `next.config.ts` nạp bằng bộ phân giải TypeScript gốc của Node,
 * nên chỉ dùng cú pháp TypeScript "xóa được" (không enum, không namespace) và
 * không import alias `@/`.
 *
 * CSP theo phương án "không nonce" trong tài liệu Next.js 16 (đặt qua next.config):
 * nonce buộc mọi trang render động và không tương thích Partial Prerendering
 * (cacheComponents). Ứng dụng không nhúng script bên thứ ba và không hiển thị
 * HTML do người dùng nhập, nên `'unsafe-inline'` cho script là chấp nhận được ở
 * giai đoạn này. Xem docs/ARCHITECTURE.md §18.
 */

export type HttpHeader = { key: string; value: string };

export type SecurityHeaderOptions = {
  /** `true` khi chạy `next dev`: React cần `eval` để dựng lại stack lỗi, HMR cần WebSocket. */
  isDev: boolean;
};

/** Tắt các quyền thiết bị nhạy cảm ở mọi trang (không ghi âm/quay phim/định vị trẻ). */
export const PERMISSIONS_POLICY = ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"].join(", ");

export function buildContentSecurityPolicy({ isDev }: SecurityHeaderOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(isDev ? ["ws:", "wss:"] : [])],
    "media-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): HttpHeader[] {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "X-Frame-Options", value: "DENY" },
  ];
}

/**
 * Trang liên kết thiết bị (/join) sẽ nhận mã thẻ học ở fragment của URL (GĐ5):
 * không gửi Referer để tránh rò rỉ địa chỉ trang sang nơi khác.
 */
export const JOIN_PAGE_HEADERS: HttpHeader[] = [{ key: "Referrer-Policy", value: "no-referrer" }];
