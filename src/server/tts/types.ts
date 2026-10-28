/**
 * Cổng chuyển văn bản thành tiếng (R10.1; docs/AUDIO_ENGINE.md §5). Chỉ chạy ở máy chủ, chỉ cho GV/tác vụ
 * tạo âm thanh trước — học sinh không bao giờ gọi (CLAUDE.md §8). Không import gì của trình duyệt.
 */

/** Mục đích của lời đọc. KHÔNG có `phoneme`/`rime`: âm, vần đơn lẻ bắt buộc dùng bản ghi âm GV (PRD A7). */
export const TTS_PURPOSES = ["instruction", "feedback", "picture_name", "word", "sentence", "model"] as const;
export type TtsPurpose = (typeof TTS_PURPOSES)[number];

export type TtsSpeed = "slow" | "normal";

export type TtsRequest = {
  /** Lời đọc (NFC). Không bao giờ chứa dữ liệu học sinh. */
  text: string;
  purpose: TtsPurpose;
  /** Khóa giọng nội bộ (ví dụ `vi-female-1`), ánh xạ sang tên giọng của nhà cung cấp trong adapter. */
  voiceKey: string;
  speed: TtsSpeed;
};

export type TtsAudio = {
  bytes: Uint8Array;
  mimeType: "audio/mpeg" | "audio/wav" | "audio/ogg";
};

export const TTS_ERROR_CODES = [
  "NO_PROVIDER",
  "INVALID_INPUT",
  "PERSONAL_DATA_REJECTED",
  "TEACHER_RECORDING_REQUIRED",
  "AUDIO_ROLE_FORBIDDEN",
  "AUDIO_LEAKS_ANSWER",
  "BUDGET_EXCEEDED",
  "TIMEOUT",
  "PROVIDER_ERROR",
] as const;
export type TtsErrorCode = (typeof TTS_ERROR_CODES)[number];

export type TtsOutcome = { ok: true; data: TtsAudio } | { ok: false; code: TtsErrorCode };

export type SynthesizeOptions = { signal: AbortSignal };

/**
 * Hợp đồng của một nhà cung cấp. Adapter chỉ nhận yêu cầu ĐÃ được kiểm tra (`request.ts`) và trả lỗi bằng mã,
 * không ném ngoại lệ chứa nội dung yêu cầu, khóa API hay phản hồi thô.
 */
export interface TtsProvider {
  readonly id: "none" | "mock" | "google" | "fpt";
  /** Nhà cung cấp có thật sự gọi dịch vụ bên ngoài (để tính chi phí/giới hạn). */
  readonly external: boolean;
  synthesize(request: TtsRequest, options: SynthesizeOptions): Promise<TtsOutcome>;
}
