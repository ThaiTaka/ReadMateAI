/**
 * Đọc cấu hình Supabase. Chỉ chấp nhận khóa kiểu mới (`sb_publishable_…`, `sb_secret_…`): khóa JWT
 * `anon`/`service_role` cũ bị Supabase khai tử cuối 2026 (ARCHITECTURE §3.2) nên bị từ chối ở đây.
 *
 * Thiếu cấu hình → trả `null`: ứng dụng vẫn chạy (trang công khai, /demo), các chức năng tài khoản hiện
 * "chưa cấu hình máy chủ dữ liệu" thay vì lỗi.
 */

export type SupabasePublicEnv = { url: string; publishableKey: string };

export function readSupabasePublicEnv(
  source: Readonly<Record<string, string | undefined>> = process.env,
): SupabasePublicEnv | null {
  const url = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  if (!/^https?:\/\//u.test(url) || !publishableKey.startsWith("sb_publishable_")) return null;
  return { url: url.replace(/\/+$/u, ""), publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return readSupabasePublicEnv() !== null;
}
