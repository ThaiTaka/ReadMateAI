import { z } from "zod";
import { nfc, sha256Hex } from "../hash.ts";
import { POC_VOICE_KEYS } from "./voices.ts";

/**
 * Sổ ghi các tệp nghe thử (R10.3b2-P0). Tệp thật và `manifest.json` nằm trong thư mục cục bộ `.tts-poc/` (được .gitignore):
 * quyền LƯU và PHÂN PHỐI tệp giọng máy chưa được xác minh (TTS_APPROVAL_CHECKLIST P6) nên không đưa lên Git hay Storage.
 * Sổ không chứa khóa API, không dữ liệu học sinh, và không có trạng thái "đã duyệt" — duyệt là việc của giáo viên, ở nơi khác.
 */

export const POC_CONFIG_VERSION = "poc-1";
export const POC_MANIFEST_VERSION = 1;
export const POC_FILE_PATTERN = /^[0-9a-f]{64}\.(?:mp3|wav)$/u;

export const pocSampleSchema = z.strictObject({
  /** Khóa yêu cầu (chống gọi lặp): cùng nhà cung cấp + giọng + tốc độ + định dạng + chữ ⇒ cùng khóa. */
  requestKey: z.string().regex(/^[0-9a-f]{64}$/u),
  /** Tên tệp = sha256 của NỘI DUNG + đuôi: hai yêu cầu cho ra cùng byte chỉ lưu một tệp. */
  file: z.string().regex(POC_FILE_PATTERN),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  provider: z.enum(["viettel", "fpt", "google"]),
  voiceKey: z.enum(POC_VOICE_KEYS),
  providerVoice: z.string().min(1),
  speed: z.enum(["slow", "normal"]),
  format: z.enum(["mp3", "wav"]),
  mime: z.enum(["audio/mpeg", "audio/wav"]),
  sentenceId: z.string().min(1),
  sentenceKind: z.enum(["catalog", "diagnostic"]),
  text: z.string().min(1),
  chars: z.number().int().positive(),
  bytes: z.number().int().positive(),
  durationMs: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});
export type PocSample = z.infer<typeof pocSampleSchema>;

export const pocManifestSchema = z.strictObject({
  version: z.literal(POC_MANIFEST_VERSION),
  samples: z.array(pocSampleSchema),
});
export type PocManifest = z.infer<typeof pocManifestSchema>;

export const emptyManifest = (): PocManifest => ({ version: POC_MANIFEST_VERSION, samples: [] });

const SEP = String.fromCharCode(1);

export function requestKeyOf(input: {
  provider: string;
  voiceKey: string;
  speed: string;
  format: string;
  text: string;
}): string {
  return sha256Hex(
    [POC_CONFIG_VERSION, input.provider, input.voiceKey, input.speed, input.format, nfc(input.text)].join(SEP),
  );
}

/** Thêm mẫu vào sổ, thay mẫu cùng `requestKey` nếu có. Hàm thuần. */
export function withSample(manifest: PocManifest, sample: PocSample): PocManifest {
  return {
    ...manifest,
    samples: [...manifest.samples.filter((entry) => entry.requestKey !== sample.requestKey), sample],
  };
}
