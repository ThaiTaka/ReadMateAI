import type { TtsVoiceProfile } from "../tts/voice.ts";

/**
 * Cấu hình giọng của thư viện giọng máy cho câu lệnh/lời phản hồi cố định (R10.5; docs/AUDIO_ENGINE.md §17). Hằng số thuần — KHÔNG
 * có mã gọi nhà cung cấp ở đây (đường phát cho học sinh chỉ import tệp này, không import `provider.ts`).
 *
 * Giọng: khóa nội bộ `vi-male-1` → (adapter Viettel) `hcm-minhquan` (nam, miền Nam), tốc độ "slow" = 0,9. Đây là giọng THỬ do chủ dự án chọn sau khi nghe trên
 * giao diện của nhà cung cấp — KHÔNG thay bước giáo viên nghe và duyệt từng tệp. Đổi giọng/tốc độ/thông số → đổi `configVersion`
 * → mọi bản đã duyệt cũ thành "lỗi thời" (không phát) cho tới khi tạo và duyệt lại.
 */

export const LIBRARY_PROVIDER_ID = "viettel" as const;

export const LIBRARY_VOICE: TtsVoiceProfile = {
  voiceKey: "vi-male-1",
  speed: "slow",
  configVersion: "viettel-minhquan-0.9-v1",
};

/** Hạn mức ký tự cho MỘT lần bấm "Tạo âm thanh": một lời đọc không vượt trần của nhà cung cấp (300). */
export const LIBRARY_CALL_CHAR_LIMIT = 300;
/** Một lần bấm "tạo các lời còn thiếu" tối đa bấy nhiêu lời — chặn chi phí bất ngờ. */
export const LIBRARY_BULK_LIMIT = 10;
