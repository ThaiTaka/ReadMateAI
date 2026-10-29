import { z } from "zod";
import type { TtsScriptEntry } from "./catalog.ts";
import { assetKeyOf } from "./hash.ts";
import type { TtsScriptStatus } from "./script-review.ts";
import { isProvisionalVoice, TTS_VOICE_KEYS, type TtsVoiceProfile } from "./voice.ts";

/**
 * Phiên bản tệp âm thanh TTS và điều kiện được dùng (R10.3b1; docs/AUDIO_ENGINE.md §14.3–§14.5). HÀM THUẦN.
 * Bước 2 trong hai bước duyệt: giáo viên NGHE tệp đã tạo. Phiên bản bất biến — đổi chữ/giọng/nhà cung cấp tạo phiên
 * bản MỚI (khóa tệp khác), không sửa tệp đã duyệt. Dữ liệu này CHƯA có bảng CSDL (không migration ở R10.3b1): đây là hợp
 * đồng kiểu cho R10.3b2.
 */

export const TTS_VERSION_STATUSES = ["pending_review", "approved", "rejected", "superseded", "revoked"] as const;
export type TtsVersionStatus = (typeof TTS_VERSION_STATUSES)[number];

export const ttsAudioVersionSchema = z.strictObject({
  versionId: z.uuid(),
  entryId: z.string().min(1),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/u),
  assetKey: z.string().regex(/^[0-9a-f]{64}$/u),
  provider: z.enum(["none", "mock", "google"]),
  voice: z.strictObject({
    voiceKey: z.enum(TTS_VOICE_KEYS),
    speed: z.enum(["slow", "normal"]),
    configVersion: z.string().min(1),
  }),
  audio: z.strictObject({
    sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    byteLength: z.number().int().positive(),
    mime: z.enum(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"]),
    durationMs: z.number().int().positive(),
    inspected: z.literal(true),
  }),
  /** Tạo bởi nhà cung cấp kiểm thử/dữ liệu kiểm thử — không bao giờ được dùng cho học sinh. */
  testOnly: z.boolean(),
  status: z.enum(TTS_VERSION_STATUSES),
  /** Giáo viên đã NGHE tệp và duyệt. */
  reviewedBy: z.uuid().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  listened: z.boolean(),
  pronunciationConfirmed: z.boolean(),
});
export type TtsAudioVersion = z.infer<typeof ttsAudioVersionSchema>;

export type UnusableCode =
  | "INVALID_RECORD"
  | "TEST_ONLY"
  | "NOT_APPROVED"
  | "SUPERSEDED"
  | "REVOKED"
  | "NOT_REVIEWED"
  | "SCRIPT_NOT_APPROVED"
  | "CONTENT_CHANGED"
  | "ASSET_MISMATCH"
  | "VOICE_NOT_CHOSEN"
  | "VOICE_CHANGED";

export type UsableCheck = { ok: true } | { ok: false; code: UnusableCode };

const sameVoice = (a: TtsVoiceProfile, b: TtsVoiceProfile) =>
  a.voiceKey === b.voiceKey && a.speed === b.speed && a.configVersion === b.configVersion;

/**
 * Một phiên bản có được dùng cho mục này không? Từng điều kiện đều phải đạt; thứ tự kiểm tra cố định để mã lỗi ổn định.
 * `voice` là cấu hình giọng HIỆN HÀNH (đã được chọn); bản tạo bằng giọng/phiên bản cấu hình khác không dùng được.
 */
export function checkVersionUsable(params: {
  version: unknown;
  entry: TtsScriptEntry;
  scriptStatus: TtsScriptStatus;
  voice: TtsVoiceProfile;
}): UsableCheck {
  const parsed = ttsAudioVersionSchema.safeParse(params.version);
  if (!parsed.success) return { ok: false, code: "INVALID_RECORD" };
  const version = parsed.data;
  const { entry, scriptStatus, voice } = params;

  if (version.testOnly || version.provider === "mock" || version.provider === "none") {
    return { ok: false, code: "TEST_ONLY" };
  }
  if (version.status === "revoked") return { ok: false, code: "REVOKED" };
  if (version.status === "superseded") return { ok: false, code: "SUPERSEDED" };
  if (version.status !== "approved") return { ok: false, code: "NOT_APPROVED" };
  if (!version.reviewedBy || !version.reviewedAt || !version.listened || !version.pronunciationConfirmed) {
    return { ok: false, code: "NOT_REVIEWED" };
  }
  if (scriptStatus !== "approved") return { ok: false, code: "SCRIPT_NOT_APPROVED" };
  if (version.contentHash !== entry.contentHash) return { ok: false, code: "CONTENT_CHANGED" };
  const expectedKey = assetKeyOf({
    providerId: version.provider,
    purpose: entry.purpose,
    text: entry.text,
    voice: version.voice,
  });
  if (expectedKey !== version.assetKey) return { ok: false, code: "ASSET_MISMATCH" };
  if (isProvisionalVoice(voice) || isProvisionalVoice(version.voice)) return { ok: false, code: "VOICE_NOT_CHOSEN" };
  if (!sameVoice(version.voice, voice)) return { ok: false, code: "VOICE_CHANGED" };
  return { ok: true };
}

/**
 * Hai nơi dùng chung một tệp khi trùng khóa tệp VÀ phiên bản dùng được cho mục đang xét (duyệt lời đọc của chính mục đó).
 * Trả bản duyệt mới nhất; nếu không có, trả các lý do để hiển thị cho giáo viên.
 */
export function findReusableVersion(params: {
  versions: readonly unknown[];
  entry: TtsScriptEntry;
  scriptStatus: TtsScriptStatus;
  voice: TtsVoiceProfile;
  providerId: string;
}): { ok: true; version: TtsAudioVersion } | { ok: false; reasons: UnusableCode[] } {
  const wanted = assetKeyOf({
    providerId: params.providerId,
    purpose: params.entry.purpose,
    text: params.entry.text,
    voice: params.voice,
  });
  const usable: TtsAudioVersion[] = [];
  const reasons = new Set<UnusableCode>();
  for (const raw of params.versions) {
    const parsed = ttsAudioVersionSchema.safeParse(raw);
    if (!parsed.success) continue;
    if (parsed.data.assetKey !== wanted) continue;
    const check = checkVersionUsable({ ...params, version: parsed.data });
    if (check.ok) usable.push(parsed.data);
    else reasons.add(check.code);
  }
  usable.sort((a, b) => Date.parse(b.reviewedAt ?? "") - Date.parse(a.reviewedAt ?? ""));
  const best = usable[0];
  if (best) return { ok: true, version: best };
  return { ok: false, reasons: [...reasons] };
}
