/**
 * Giới hạn và định dạng của bản ghi giáo viên (R10.2) — MỘT nơi, dùng ở máy chủ, trình duyệt, kiểm thử và để đối chiếu
 * với ràng buộc CSDL (migration 20261031090000: size_bytes ≤ 2 MiB, duration_ms 300–10000, mime_type trong danh sách).
 * Thuần dữ liệu, không phụ thuộc nên import được ở cả Client Component lẫn script.
 */

/** Dung lượng tối đa mỗi bản ghi: bản ngắn ~10 giây; WAV PCM 16-bit 44,1 kHz một kênh ≈ 880 KB nên 2 MiB là dư cho mọi định dạng. */
export const AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const AUDIO_MIN_DURATION_MS = 300;
export const AUDIO_MAX_DURATION_MS = 10_000;
/** Ghi trực tiếp tự dừng sớm hơn trần để độ trễ của MediaRecorder không làm bản ghi vượt giới hạn. */
export const RECORDING_AUTO_STOP_MS = 9_000;

export const AUDIO_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"] as const;
export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number];

export const AUDIO_EXTENSIONS: Record<AudioMimeType, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** Định dạng nhận khi GV tải tệp lên (thuộc tính accept của ô chọn tệp — chỉ là gợi ý, máy chủ kiểm tra chữ ký tệp). */
export const AUDIO_FILE_ACCEPT = ".webm,.ogg,.oga,.opus,.m4a,.mp4,.mp3,.wav,audio/*";

/** Tên bucket Storage riêng tư (khớp supabase/config.toml và ràng buộc CSDL). */
export const AUDIO_BUCKET = "teacher-audio";

/** Phiên bản thông báo đồng ý dùng giọng; đổi nội dung thông báo thì tăng số này (CSDL lưu để biết GV đã đồng ý bản nào). */
export const VOICE_NOTICE_VERSION = "v1";
