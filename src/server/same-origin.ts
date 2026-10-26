import "server-only";

/**
 * Yêu cầu có đến từ chính trang này không (chống CSRF cho Route Handler dùng cookie phiên).
 * So Origin với Host mà trình duyệt đã gọi (không dùng `request.url`: máy chủ Next có thể dựng URL bằng tên máy khác,
 * ví dụ `localhost` thay cho `127.0.0.1`). Trên Vercel, `x-forwarded-host` là tên miền thật của trang.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}
