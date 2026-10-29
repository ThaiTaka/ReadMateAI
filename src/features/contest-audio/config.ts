/**
 * Cấu hình CHẾ ĐỘ TRÌNH DIỄN CUỘC THI cho âm thanh (docs/CONTEST_AUDIO.md). Hằng số thuần.
 *
 * Đây là một miền dữ liệu RIÊNG, tách hẳn bản ghi giáo viên (`audio_assets`) và thư viện giọng máy đã duyệt (`tts_audio_versions`):
 * bảng riêng, bucket riêng, cờ riêng, hàm phát riêng. Tệp ở đây luôn mang nguồn gốc `ai_generated` / `contest_preview` và chỉ
 * qua kiểm tra KỸ THUẬT — không có cột "đã duyệt", nên không có đường nào biến chúng thành "giáo viên đã duyệt".
 */

/** Nguồn gốc cố định của mọi tệp trình diễn. */
export const CONTEST_ORIGIN = "ai_generated" as const;
export const CONTEST_PURPOSE = "contest_preview" as const;
export const CONTEST_TECHNICAL_CHECK = "technical_check_passed" as const;

export const CONTEST_PROVIDER_ID = "viettel" as const;
/** Cùng giọng/tốc độ với thư viện R10.5 (Viettel Minh Quân 0,9) nhưng KHÁC `configVersion` → khóa tệp khác, không dùng chung với bản đã duyệt. */
export const CONTEST_VOICE = {
  voiceKey: "vi-male-1",
  speed: "slow",
  configVersion: "contest-viettel-minhquan-0.9-v1",
} as const;
export const CONTEST_BUCKET = "contest-audio";

/** Một lời đọc không vượt trần ký tự của nhà cung cấp (300). */
export const CONTEST_CHAR_LIMIT = 300;

/**
 * Giới hạn số yêu cầu gửi nhà cung cấp (chi phí): mỗi lần chạy, và tổng cộng suốt đời của sổ ghi trên máy này. Danh mục có 101 mục
 * nhưng nhiều mục chung một câu chữ (khóa tệp giống nhau) nên số yêu cầu thật ít hơn.
 */
export const CONTEST_RUN_DEFAULT_MAX_REQUESTS = 40;
export const CONTEST_RUN_HARD_MAX_REQUESTS = 120;
export const CONTEST_LIFETIME_MAX_REQUESTS = 150;
/** Dừng ngay sau chừng này lần lỗi liên tiếp (khóa sai, hết hạn mức) để không tốn thêm lượt. */
export const CONTEST_MAX_CONSECUTIVE_FAILURES = 3;

/** Hai cờ hệ thống của miền trình diễn (mặc định TẮT ở mọi môi trường). */
export const CONTEST_FLAG_ENABLED = "contest_audio_preview_enabled";
export const CONTEST_FLAG_PLAY_UNVERIFIED = "contest_audio_play_unverified";

export type ContestEntryKind = "letter" | "phoneme" | "instruction" | "feedback";
export const CONTEST_ENTRY_KINDS: readonly ContestEntryKind[] = ["letter", "phoneme", "instruction", "feedback"];

/** `unreviewed` = chỉ qua kiểm tra kỹ thuật, chưa ai nghe/duyệt cách đọc. `needs_verification` = có rủi ro cụ thể, mặc định KHÔNG phát. */
export type ContestRiskClass = "standard" | "needs_verification";
