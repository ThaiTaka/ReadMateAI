import { z } from "zod";
import { POC_VOICE_KEYS } from "./poc/voices.ts";
import { TTS_PURPOSES, type TtsRequest } from "./types.ts";

/**
 * Kiểm tra yêu cầu TTS ở ranh giới (CLAUDE.md §9). Văn bản chuẩn hóa NFC; giới hạn độ dài để chặn chi phí
 * bất thường; từ chối chữ giống dữ liệu cá nhân (email, số điện thoại, chuỗi số dài, mã thẻ học) — lời đọc
 * của ReadMate chỉ là câu lệnh, từ, câu học liệu, lời khen. Biệt danh học sinh không thể nhận diện bằng mẫu,
 * nên cổng này CHỈ nhận văn bản từ học liệu/chuỗi giao diện cố định do GV duyệt, không từ trường nhập của học sinh.
 */

export const TTS_MAX_CHARS = 300;
export const TTS_MIN_CHARS = 1;
export const VOICE_KEYS = ["vi-female-1", "vi-male-1"] as const;

const nfcText = z
  .string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(z.string().min(TTS_MIN_CHARS).max(TTS_MAX_CHARS));

export const ttsRequestSchema = z.strictObject({
  text: nfcText,
  purpose: z.enum(TTS_PURPOSES),
  // Khóa giọng thử nghiệm (R10.3b2-P0) chỉ để nghe thử; danh mục/lô sản xuất vẫn chỉ dùng `VOICE_KEYS` (voice.ts).
  voiceKey: z.enum([...VOICE_KEYS, ...POC_VOICE_KEYS]),
  speed: z.enum(["slow", "normal"]),
});

// Dựng bằng mã ký tự để tệp nguồn không chứa ký tự ẩn (CLAUDE.md §9.6.6).
const CONTROL_OR_INVISIBLE = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}\u200b-\u200f\u2028-\u202e\ufeff]`,
  "u",
);

const PERSONAL_PATTERNS: readonly RegExp[] = [
  /\S+@\S+/u, // email
  /(?:\+?\d[\s.-]?){7,}/u, // số điện thoại / chuỗi số dài
  /https?:\/\//iu,
  /[A-Z0-9]{4}-[A-Z0-9]{4}/u, // dạng mã thẻ học
  CONTROL_OR_INVISIBLE, // ký tự điều khiển/ẩn
  /[<>]/u, // chặn chèn SSML/HTML từ văn bản
];

export type RequestCheck =
  { ok: true; data: TtsRequest } | { ok: false; code: "INVALID_INPUT" | "PERSONAL_DATA_REJECTED" };

export function checkTtsRequest(input: unknown): RequestCheck {
  const parsed = ttsRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (PERSONAL_PATTERNS.some((pattern) => pattern.test(parsed.data.text))) {
    return { ok: false, code: "PERSONAL_DATA_REJECTED" };
  }
  return { ok: true, data: parsed.data };
}
