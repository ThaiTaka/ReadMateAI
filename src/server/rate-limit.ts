import "server-only";
import { hmacHex, isUsablePepper } from "@/features/login-codes/codes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Giới hạn tần suất ở tầng ứng dụng (bảng `rate_limit_buckets`, hàm nguyên tử `gateway_consume_rate_limit`).
 * Khóa = HMAC(pepper, mục đích, giá trị) → CSDL không chứa IP/email thô. Bổ sung cho giới hạn của Supabase Auth.
 */

export type RateLimitRule = { purpose: string; windowSeconds: number; limit: number };

export const RATE_LIMITS = {
  /** Đăng nhập GV theo IP: 10 lần / 15 phút. */
  loginByAddress: { purpose: "login.address", windowSeconds: 900, limit: 10 },
  /** Đăng nhập GV theo email: 5 lần / 15 phút (chống dò mật khẩu một tài khoản từ nhiều IP). */
  loginByAccount: { purpose: "login.account", windowSeconds: 900, limit: 5 },
  /** Nhập mã thẻ học theo IP: 10 lần / 15 phút. */
  joinByAddress: { purpose: "join.address", windowSeconds: 900, limit: 10 },
  /** Toàn hệ thống: 300 lần nhập mã / giờ (chặn dò mã phân tán). */
  joinGlobal: { purpose: "join.global", windowSeconds: 3600, limit: 300 },
  /** Tải bản ghi giáo viên lên (R10.2): 60 lần / giờ / tài khoản — chặn lặp vô tình và làm đầy kho lưu. */
  audioUpload: { purpose: "audio.upload", windowSeconds: 3600, limit: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitOutcome = "allowed" | "limited" | "unavailable";

export async function consumeRateLimit(rule: RateLimitRule, value: string): Promise<RateLimitOutcome> {
  const pepper = process.env.LOGIN_CODE_PEPPER;
  const admin = createSupabaseAdminClient();
  if (!admin || !isUsablePepper(pepper)) return "unavailable";
  const { data, error } = await admin.rpc("gateway_consume_rate_limit", {
    p_key_hash: hmacHex(pepper, rule.purpose, value),
    p_window_seconds: rule.windowSeconds,
    p_limit: rule.limit,
  });
  if (error) return "unavailable";
  return data === true ? "allowed" : "limited";
}
