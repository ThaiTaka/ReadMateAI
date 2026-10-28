import { createHash } from "node:crypto";
import type { TtsPurpose } from "./types.ts";
import type { TtsVoiceProfile } from "./voice.ts";

/**
 * Băm cho danh mục TTS (R10.3b1). Dùng `node:crypto` nên CHỈ import ở máy chủ/kiểm thử/script — không import vào mã
 * trình duyệt (test quét mã `use client`).
 */

/** Dấu phân cách trường (U+0001) dựng bằng mã ký tự để tệp nguồn không chứa ký tự điều khiển (CLAUDE.md §9.6.6). */
const SEP = String.fromCharCode(1);

export const TTS_CATALOG_VERSION = 1;

export const sha256Hex = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

export const nfc = (text: string): string => text.normalize("NFC").trim();

/**
 * Băm NỘI DUNG giáo viên duyệt: phiên bản danh mục + mục đích + văn bản NFC. Đổi chữ → hash khác → mọi duyệt cũ hết hiệu lực.
 * Không gồm giọng (giọng thuộc `assetKey`) và không gồm vai trò (một lời đọc giống hệt dùng ở nhiều vai trò vẫn là một nội dung).
 */
export function contentHashOf(input: { purpose: TtsPurpose; text: string }): string {
  return sha256Hex([String(TTS_CATALOG_VERSION), input.purpose, nfc(input.text)].join(SEP));
}

export type AssetKeyInput = {
  providerId: string;
  purpose: TtsPurpose;
  text: string;
  voice: TtsVoiceProfile;
};

/**
 * Khóa dùng lại tệp: hai nơi dùng chung MỘT tệp khi và chỉ khi trùng nhà cung cấp, mục đích, văn bản NFC, mã giọng, tốc độ và
 * phiên bản cấu hình giọng. Không chứa dữ liệu học sinh.
 */
export function assetKeyOf(input: AssetKeyInput): string {
  return sha256Hex(
    [
      input.providerId,
      input.purpose,
      input.voice.voiceKey,
      input.voice.speed,
      input.voice.configVersion,
      nfc(input.text),
    ].join(SEP),
  );
}
