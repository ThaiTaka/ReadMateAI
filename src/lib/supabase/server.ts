import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";
import type { Database } from "./database.types";
import { readSupabasePublicEnv } from "./env";

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * Client mang JWT của người dùng hiện tại (đọc cookie) → mọi truy vấn chịu RLS.
 * Tạo mới cho mỗi request (không dùng chung giữa các request). `null` khi chưa cấu hình Supabase.
 */
export async function createSupabaseServerClient(): Promise<AppSupabaseClient | null> {
  const env = readSupabasePublicEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(env.url, env.publishableKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component không được ghi cookie; src/proxy.ts đã làm mới phiên trước khi trang render.
        }
      },
    },
  });
}
