/**
 * Cookie phiên Supabase: httpOnly (JavaScript của trang không đọc được token → XSS không lấy được phiên),
 * SameSite=Lax, Secure. Ứng dụng KHÔNG có client Supabase ở trình duyệt: mọi lời gọi Supabase đi qua máy chủ
 * (proxy, Server Component, Server Action), nên CSP `connect-src 'self'` giữ nguyên.
 *
 * Secure luôn bật, TRỪ khi trang chạy rõ ràng bằng http trên 127.0.0.1 hoặc localhost (máy dev / E2E):
 * Safari/WebKit bỏ cookie Secure trên http kể cả localhost (Chromium thì chấp nhận) — đã gặp ở E2E WebKit.
 * Production (Vercel, HTTPS) không đặt NEXT_PUBLIC_SITE_URL dạng http + localhost nên luôn Secure.
 *
 * Tách riêng (không `server-only`) vì `src/proxy.ts` không chạy trong lớp React Server Components.
 */
const LOCAL_HTTP = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/u;

export function isLocalHttpSite(siteUrl: string | undefined): boolean {
  return LOCAL_HTTP.test(siteUrl?.trim() ?? "");
}

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: !isLocalHttpSite(process.env.NEXT_PUBLIC_SITE_URL),
} as const;
