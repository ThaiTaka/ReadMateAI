import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "./lib/supabase/proxy";

/**
 * Proxy (Next 16 — thay cho middleware.ts): làm mới phiên Supabase và chuyển hướng THÔ khi vào khu vực
 * giáo viên mà chưa đăng nhập. Đây KHÔNG phải lớp phân quyền: mỗi trang/Server Action tự xác minh lại
 * (src/server/auth/teacher.ts) và CSDL kiểm tra lần nữa bằng RLS + hàm (tài liệu Next: proxy.md).
 */
export async function proxy(request: NextRequest) {
  const session = await updateSupabaseSession(request);
  const { pathname, search } = request.nextUrl;

  if (pathname === "/teacher" || pathname.startsWith("/teacher/")) {
    if (!session.userId || session.isAnonymous) {
      const reason = session.isAnonymous ? "student_device" : session.hadSessionCookie ? "expired" : "required";
      const url = new URL("/login", request.url);
      url.searchParams.set("reason", reason);
      url.searchParams.set("next", `${pathname}${search}`);
      const redirect = NextResponse.redirect(url);
      // Giữ cookie vừa làm mới/xóa của phiên (nếu có).
      for (const cookie of session.response.cookies.getAll()) redirect.cookies.set(cookie);
      redirect.headers.set("Cache-Control", "private, no-store");
      return redirect;
    }
  }
  return session.response;
}

export const config = {
  matcher: ["/teacher", "/teacher/:path*", "/learn/:path*", "/join", "/login"],
};
