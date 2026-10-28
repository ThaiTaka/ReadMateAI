/**
 * Cấu hình giọng đọc TTS (R10.3b1; docs/AUDIO_ENGINE.md §14). HÀM/HẰNG THUẦN.
 *
 * Giọng đọc CHƯA được chủ dự án/giáo viên chọn (docs/TTS_APPROVAL_CHECKLIST.md): giá trị dưới đây chỉ là chỗ giữ chỗ để
 * lập kế hoạch. `configVersion` bắt đầu bằng `provisional` nghĩa là "chưa chọn giọng" — bản âm thanh gắn với cấu hình đó
 * không bao giờ được coi là dùng được (versions.ts). Khi giọng được chọn, đặt một `configVersion` mới → mọi tệp cũ
 * thành phiên bản khác (không sửa tệp đã duyệt).
 */

export const TTS_VOICE_KEYS = ["vi-female-1", "vi-male-1"] as const;
export type TtsVoiceKey = (typeof TTS_VOICE_KEYS)[number];
export type TtsVoiceSpeed = "slow" | "normal";

export type TtsVoiceProfile = {
  voiceKey: TtsVoiceKey;
  speed: TtsVoiceSpeed;
  /** Tăng khi đổi giọng thật của nhà cung cấp, bảng ánh xạ giọng hoặc thông số đọc — làm tệp cũ thành phiên bản khác. */
  configVersion: string;
};

export const PROVISIONAL_CONFIG_PREFIX = "provisional";

/** Giữ chỗ — KHÔNG phải quyết định chọn giọng. */
export const PROVISIONAL_VOICE: TtsVoiceProfile = {
  voiceKey: "vi-female-1",
  speed: "slow",
  configVersion: `${PROVISIONAL_CONFIG_PREFIX}-0`,
};

export function isProvisionalVoice(voice: TtsVoiceProfile): boolean {
  return voice.configVersion.startsWith(PROVISIONAL_CONFIG_PREFIX);
}
