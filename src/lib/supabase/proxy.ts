import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { readSupabasePublicEnv } from "./env";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

export type ProxySession = {
  response: NextResponse;
  /** `sub` của JWT đã xác minh (getClaims), hoặc null. */
  userId: string | null;
  isAnonymous: boolean;
  /** Có cookie phiên nhưng không xác minh được (hết hạn/không hợp lệ) — để báo "phiên đã hết hạn". */
  hadSessionCookie: boolean;
};

/**
 * Làm mới phiên Supabase cho mỗi request (mẫu chính thức của @supabase/ssr cho proxy/middleware):
 * đọc cookie từ request, ghi cookie đã làm mới vào cả request (cho Server Component phía sau) lẫn response.
 * Chỉ dùng `getClaims()` (xác minh chữ ký JWT) — không tin `getSession()` ở máy chủ.
 */
export async function updateSupabaseSession(request: NextRequest): Promise<ProxySession> {
  let response = NextResponse.next({ request });
  const hadSessionCookie = request.cookies.getAll().some((cookie) => /^sb-.+-auth-token/u.test(cookie.name));
  const env = readSupabasePublicEnv();
  if (!env) return { response, userId: null, isAnonymous: false, hadSessionCookie };

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return {
    response,
    userId: typeof claims?.sub === "string" ? claims.sub : null,
    isAnonymous: claims?.is_anonymous === true,
    hadSessionCookie,
  };
}
