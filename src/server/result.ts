/**
 * Kết quả có kiểu của Server Action / dịch vụ máy chủ (CLAUDE.md §9): `{ ok, data } | { ok: false, code }`.
 * Mã lỗi là chuỗi máy đọc; câu chữ tiếng Việt cho từng mã ở `vi.errors` (không lộ thông tin kỹ thuật).
 */

export const ERROR_CODES = [
  "NOT_CONFIGURED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "INVALID_CREDENTIALS",
  "NOT_STAFF",
  "RATE_LIMITED",
  "DUPLICATE_NAME",
  "DUPLICATE_NUMBER",
  "DUPLICATE_ALIAS",
  "DUPLICATE_CLASS",
  "CLASS_ARCHIVED",
  "STUDENT_INACTIVE",
  "ALIAS_MISSING",
  "ATTESTATION_REQUIRED",
  "CONSENT_ALREADY_ACTIVE",
  "CONSENT_NOT_ACTIVE",
  "CURRICULUM_NOT_CONFIRMABLE",
  "LESSON_NOT_IN_SERIES",
  "CODE_INVALID",
  "TEACHER_SESSION_ACTIVE",
  // R04 — buổi luyện có điểm, lượt trả lời, thẻ bản đồ (migration 20261021090100).
  "NOT_FOUND",
  "CONSENT_REQUIRED",
  "CURRICULUM_UNCONFIRMED",
  "NO_BAND",
  "SEASON_CLOSED",
  "INSUFFICIENT_CONTENT",
  "CONTENT_NOT_ELIGIBLE",
  "QUESTION_CLOSED",
  "NO_ATTEMPTS_LEFT",
  "DUPLICATE_RESPONSE",
  "IDEMPOTENCY_CONFLICT",
  "NO_TILE_AVAILABLE",
  "NOT_ADJACENT",
  // R05 — bảng xếp hạng (migration 20261022090000).
  "LEADERBOARD_NOT_APPROVED",
  "LEADERBOARD_DISABLED",
  "UNKNOWN",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = <T = never>(code: ErrorCode): Result<T> => ({ ok: false, code });

type PostgrestLikeError = { code?: string; message?: string; details?: string | null } | null | undefined;

/**
 * Ánh xạ lỗi từ hàm CSDL (message = mã máy đọc, xem migration 20261020090100) và ràng buộc unique sang mã lỗi.
 * Mọi lỗi không nhận diện được → UNKNOWN (không chuyển nguyên văn lỗi CSDL cho người dùng).
 */
export function mapDbError(error: PostgrestLikeError): ErrorCode {
  if (!error) return "UNKNOWN";
  const message = error.message ?? "";
  const known = ERROR_CODES.find((code) => message === code);
  if (known) return known;
  if (error.code === "42501") return "FORBIDDEN";
  if (error.code === "23505") {
    const text = `${message} ${error.details ?? ""}`;
    if (text.includes("students_display_name_per_class")) return "DUPLICATE_NAME";
    if (text.includes("students_class_id_student_number_key")) return "DUPLICATE_NUMBER";
    if (text.includes("students_alias_per_class")) return "DUPLICATE_ALIAS";
    if (text.includes("classes_school_id_name_school_year_key")) return "DUPLICATE_CLASS";
    if (text.includes("guardian_consents_one_active")) return "CONSENT_ALREADY_ACTIVE";
  }
  if (error.code === "23514" || error.code === "22023") return "INVALID_INPUT";
  return "UNKNOWN";
}
