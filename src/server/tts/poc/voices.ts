/**
 * Giọng NGHE THỬ (R10.3b2-P0; docs/AUDIO_ENGINE.md §15). Đây là danh sách ỨNG VIÊN để giáo viên nghe, KHÔNG phải quyết định
 * chọn giọng: không giọng nào được tuyên bố đạt chuẩn (docs/TTS_APPROVAL_CHECKLIST.md G1–G3). HẰNG SỐ THUẦN, không đọc môi trường.
 *
 * Tên giọng, vùng miền và giới tính lấy từ tài liệu chính thức của nhà cung cấp (đối chiếu 2026-10-28):
 * - FPT.AI TTS v5 (docs.fpt.ai): banmai = nữ Bắc, lannhi = nữ Nam, thuminh = nữ Bắc.
 * - Google Cloud TTS (danh sách giọng vi-VN): Neural2-A = nữ, Neural2-D = nam; Google không nêu vùng miền.
 * Azure (vi-VN-HoaiMyNeural, vi-VN-NamMinhNeural) chỉ là phương án dự phòng — CHƯA có adapter.
 */

export const POC_VOICE_KEYS = [
  "fpt-banmai",
  "fpt-lannhi",
  "fpt-thuminh",
  "google-neural2-a",
  "google-neural2-d",
] as const;
export type PocVoiceKey = (typeof POC_VOICE_KEYS)[number];

export type PocProviderId = "fpt" | "google";

export type PocVoice = {
  key: PocVoiceKey;
  provider: PocProviderId;
  /** Tên giọng đúng như nhà cung cấp gọi. */
  providerVoice: string;
  label: string;
  gender: "female" | "male";
  /** `unspecified` = nhà cung cấp không công bố vùng miền: giáo viên nghe để xác định. */
  region: "north" | "south" | "unspecified";
};

export const POC_VOICES: Readonly<Record<PocVoiceKey, PocVoice>> = {
  "fpt-banmai": {
    key: "fpt-banmai",
    provider: "fpt",
    providerVoice: "banmai",
    label: "FPT.AI banmai",
    gender: "female",
    region: "north",
  },
  "fpt-lannhi": {
    key: "fpt-lannhi",
    provider: "fpt",
    providerVoice: "lannhi",
    label: "FPT.AI lannhi",
    gender: "female",
    region: "south",
  },
  "fpt-thuminh": {
    key: "fpt-thuminh",
    provider: "fpt",
    providerVoice: "thuminh",
    label: "FPT.AI thuminh",
    gender: "female",
    region: "north",
  },
  "google-neural2-a": {
    key: "google-neural2-a",
    provider: "google",
    providerVoice: "vi-VN-Neural2-A",
    label: "Google Neural2-A",
    gender: "female",
    region: "unspecified",
  },
  "google-neural2-d": {
    key: "google-neural2-d",
    provider: "google",
    providerVoice: "vi-VN-Neural2-D",
    label: "Google Neural2-D",
    gender: "male",
    region: "unspecified",
  },
};

export const isPocVoiceKey = (value: string): value is PocVoiceKey =>
  (POC_VOICE_KEYS as readonly string[]).includes(value);

/** Giọng chạy mặc định ở lần thử đầu: hai giọng FPT.AI được chủ dự án ưu tiên (banmai Bắc, lannhi Nam). */
export const DEFAULT_POC_VOICES: readonly PocVoiceKey[] = ["fpt-banmai", "fpt-lannhi"];
