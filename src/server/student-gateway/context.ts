import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { consumeRateLimit, type RateLimitRule } from "@/server/rate-limit";
import { fail, ok, type Result } from "@/server/result";
import { getDeviceSession, type LinkedStudent } from "./session";

/**
 * Ngữ cảnh của một thao tác học sinh trong chế độ CÓ ĐIỂM (R04). Thứ tự: xác thực phiên thiết bị (getClaims) →
 * danh sách học sinh mà RLS trả cho JWT của thiết bị (đã loại liên kết thu hồi, hồ sơ tạm ngưng, lớp lưu trữ) →
 * client đặc quyền cho các hàm gateway_*. `student_id`/`class_id` KHÔNG BAO GIỜ lấy từ trình duyệt: mã học sinh
 * gửi lên chỉ là khóa tra cứu và phải nằm trong danh sách này (CLAUDE.md §6.3, §9.6.3).
 */

export type StudentContext = { authUserId: string; students: LinkedStudent[]; admin: AppSupabaseClient };

export async function studentContext(): Promise<Result<StudentContext>> {
  const session = await getDeviceSession();
  if (session.state === "not_configured") return fail("NOT_CONFIGURED");
  if (session.state !== "linked") return fail("UNAUTHENTICATED");
  const admin = createSupabaseAdminClient();
  if (!admin) return fail("NOT_CONFIGURED");
  return ok({ authUserId: session.authUserId, students: session.students, admin });
}

/** Chọn hồ sơ: không gửi mã → chỉ hợp lệ khi thiết bị liên kết đúng một em; có mã → phải thuộc thiết bị. */
export function pickStudent(context: StudentContext, studentId: string | undefined): Result<LinkedStudent> {
  if (studentId === undefined) {
    return context.students.length === 1 && context.students[0] ? ok(context.students[0]) : fail("INVALID_INPUT");
  }
  const found = context.students.find((student) => student.id === studentId);
  return found ? ok(found) : fail("FORBIDDEN");
}

export function ownsStudent(context: StudentContext, studentId: string): boolean {
  return context.students.some((student) => student.id === studentId);
}

/** Giới hạn tần suất theo thiết bị (khóa = HMAC của người dùng ẩn danh — không lưu mã thô). */
export const STUDENT_RATE_LIMITS = {
  /** Nộp đáp án: 30 lượt / phút / thiết bị (GAMIFICATION_SPEC §12 `attemptRateLimit`). */
  attempt: { purpose: "student.attempt", windowSeconds: 60, limit: 30 },
  /** Mở/tiếp tục buổi luyện, khám phá thẻ bản đồ: 30 lần / phút / thiết bị. */
  action: { purpose: "student.action", windowSeconds: 60, limit: 30 },
  /** Đọc trạng thái (trang của con, câu, buổi luyện): 120 lần / phút / thiết bị. */
  read: { purpose: "student.read", windowSeconds: 60, limit: 120 },
  /** Phát âm thanh (R10.3a): 40 lần / phút / thiết bị — đủ để nghe lại nhiều lần, chặn tải hàng loạt tệp. */
  audio: { purpose: "student.audio", windowSeconds: 60, limit: 40 },
} as const satisfies Record<string, RateLimitRule>;

export async function limitDevice(context: StudentContext, rule: RateLimitRule): Promise<Result<true>> {
  const outcome = await consumeRateLimit(rule, context.authUserId);
  if (outcome === "limited") return fail("RATE_LIMITED");
  if (outcome === "unavailable") return fail("NOT_CONFIGURED");
  return ok(true);
}

/** Gốc ngày theo giờ Việt Nam (UTC+7) — chỉ để làm seed xáo câu của buổi luyện, không lưu. */
export function vietnamDateKey(now: Date): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
