import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createSupabaseServerClient, type AppSupabaseClient } from "@/lib/supabase/server";
import type { ErrorCode } from "@/server/result";

/**
 * Lớp truy cập dữ liệu (DAL) cho phiên giáo viên — điểm DUY NHẤT xác định "người gọi là GV đang hoạt động".
 * Dùng ở mọi trang /teacher và mọi Server Action của GV (proxy chỉ chuyển hướng thô, không phân quyền).
 * Danh tính lấy từ `getClaims()` (JWT đã xác minh chữ ký); hồ sơ `staff_profiles` đọc qua RLS bằng chính JWT đó.
 */

export type TeacherSession = {
  supabase: AppSupabaseClient;
  userId: string;
  displayName: string;
  role: "teacher" | "admin";
  schoolId: string;
};

export type TeacherSessionResult =
  { ok: true; data: TeacherSession } | { ok: false; code: ErrorCode | "STUDENT_DEVICE" };

async function loadTeacherSession(): Promise<TeacherSessionResult> {
  // Phiên luôn đọc theo request: supabase-js kiểm tra hạn token bằng Date.now(), không được nằm trong bản prerender
  // (kể cả runtime prefetch của Partial Prefetching) — connection() loại phần này khỏi mọi bản dựng trước.
  await connection();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, code: "NOT_CONFIGURED" };
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || typeof claims.sub !== "string") return { ok: false, code: "UNAUTHENTICATED" };
  if (claims.is_anonymous === true) return { ok: false, code: "STUDENT_DEVICE" };

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("id, display_name, role, school_id, is_active")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!profile || !profile.is_active) return { ok: false, code: "NOT_STAFF" };

  return {
    ok: true,
    data: {
      supabase,
      userId: profile.id,
      displayName: profile.display_name,
      role: profile.role === "admin" ? "admin" : "teacher",
      schoolId: profile.school_id,
    },
  };
}

/** Một lần cho mỗi request (React `cache`): layout và trang dùng chung kết quả. */
export const getTeacherSession = cache(loadTeacherSession);

/** Cho trang /teacher: không phải GV hợp lệ → về /login kèm lý do (không bao giờ hiển thị dữ liệu). */
export async function requireTeacher(): Promise<TeacherSession> {
  const result = await getTeacherSession();
  if (result.ok) return result.data;
  const reason =
    result.code === "STUDENT_DEVICE"
      ? "student_device"
      : result.code === "NOT_STAFF"
        ? "not_staff"
        : result.code === "NOT_CONFIGURED"
          ? "not_configured"
          : "required";
  redirect(`/login?reason=${reason}`);
}
