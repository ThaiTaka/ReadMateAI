import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "./server";
import type { Database } from "./database.types";
import { readSupabasePublicEnv } from "./env";

/**
 * Client đặc quyền (khóa secret, BỎ QUA RLS) — chỉ dùng trong `src/server/student-gateway/` (liên kết thiết bị,
 * thao tác của học sinh) và script quản trị. Không bao giờ import vào mã giao diện: `server-only` làm build lỗi
 * nếu bị kéo vào Client Component. Mọi hàm dùng client này phải tự suy ra phạm vi (học sinh, lớp) từ phiên đã
 * xác minh, không lấy từ dữ liệu client gửi lên (ARCHITECTURE §7).
 */
export function createSupabaseAdminClient(): AppSupabaseClient | null {
  const env = readSupabasePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!env || !secretKey || !secretKey.startsWith("sb_secret_")) return null;
  return createClient<Database>(env.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
