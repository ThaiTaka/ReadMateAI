import "server-only";
import { headers } from "next/headers";

/**
 * IP của người gọi CHỈ để làm khóa giới hạn tần suất (băm HMAC trước khi lưu — không lưu IP thô).
 * Trên Vercel `x-forwarded-for` do nền tảng đặt; máy dev không có → dùng chung một khóa "local".
 */
export async function clientAddressForRateLimit(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "local";
}

/** Gốc URL của trang (để in liên kết QR thẻ học). Ưu tiên NEXT_PUBLIC_SITE_URL đã cấu hình. */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && /^https?:\/\//u.test(configured)) return configured.replace(/\/+$/u, "");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "127.0.0.1:3000";
  const proto =
    list.get("x-forwarded-proto") ?? (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
