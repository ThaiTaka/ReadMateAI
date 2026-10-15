import type { CurriculumProfile, ReviewStatus } from "../../knowledge/schema.ts";

/**
 * Hai chế độ nội dung (docs/EXERCISE_ENGINE.md §8):
 *
 * - `demo` — Bản chơi thử: chỉ dùng hồ sơ lớp MINH HỌA (hư cấu) và dữ liệu chưa bị từ chối
 *   (`pending_review` hoặc `approved`; bỏ `draft`), kèm cảnh báo "chưa duyệt". Không lưu kết quả,
 *   không tài khoản, không gọi AI. Không bao giờ dùng hồ sơ của lớp thật.
 * - `production` — Học thật: bắt buộc hồ sơ lớp ĐÃ ĐƯỢC GV XÁC NHẬN và mọi ngữ liệu, tranh, âm thanh,
 *   câu hỏi đều `approved`. Thiếu dữ liệu thì trả về "không có bài hợp lệ" — không nới quy tắc.
 */

export type ContentMode = "demo" | "production";

export function reviewAllowed(mode: ContentMode, status: ReviewStatus): boolean {
  return mode === "production" ? status === "approved" : status === "approved" || status === "pending_review";
}

export type ProfileGate =
  { ok: true } | { ok: false; code: "PROFILE_NOT_CONFIRMED" | "DEMO_REQUIRES_ILLUSTRATIVE_PROFILE"; message: string };

export function profileGate(mode: ContentMode, profile: CurriculumProfile): ProfileGate {
  if (mode === "production" && profile.status !== "confirmed") {
    return {
      ok: false,
      code: "PROFILE_NOT_CONFIRMED",
      message: `Hồ sơ "${profile.id}" chưa được giáo viên xác nhận — không tạo bài cho học sinh thật.`,
    };
  }
  if (mode === "demo" && profile.status !== "illustrative") {
    return {
      ok: false,
      code: "DEMO_REQUIRES_ILLUSTRATIVE_PROFILE",
      message: `Bản chơi thử chỉ dùng hồ sơ minh họa; "${profile.id}" là hồ sơ của lớp thật.`,
    };
  }
  return { ok: true };
}
