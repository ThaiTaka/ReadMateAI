import "server-only";
import { getTeacherSession, type TeacherSession } from "@/server/auth/teacher";
import { fail, type ErrorCode, type Result } from "@/server/result";

/** Trợ giúp HTTP cho Route Handlers `/api/teacher/audio/**`: không lưu bộ nhớ đệm, kết quả có kiểu, không lộ lỗi CSDL. */

const STATUS: Partial<Record<ErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  AUDIO_EMPTY: 422,
  AUDIO_INVALID: 422,
  AUDIO_TOO_SHORT: 422,
  AUDIO_TOO_LONG: 422,
  AUDIO_TOO_LARGE: 413,
  AUDIO_UNSUPPORTED: 415,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  STORAGE_UNAVAILABLE: 503,
  UNKNOWN: 500,
};

export const jsonResult = <T>(result: Result<T>): Response =>
  new Response(JSON.stringify(result), {
    status: result.ok ? 200 : (STATUS[result.code] ?? 409),
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });

/** GV hợp lệ hoặc kết quả lỗi: thiết bị học sinh / người không phải GV đều bị từ chối FORBIDDEN. */
export async function teacherOrFail(): Promise<Result<TeacherSession>> {
  const auth = await getTeacherSession();
  if (auth.ok) return auth;
  return fail(auth.code === "STUDENT_DEVICE" || auth.code === "NOT_STAFF" ? "FORBIDDEN" : auth.code);
}
