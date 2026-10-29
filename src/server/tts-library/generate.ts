import { checkSynthesizedAudio } from "../tts/audio-check.ts";
import { CharBudget, synthesizeSpeech } from "../tts/service.ts";
import type { TtsErrorCode, TtsProvider } from "../tts/types.ts";
import { fail, ok, type ErrorCode, type Result } from "../result.ts";
import { LIBRARY_CALL_CHAR_LIMIT, LIBRARY_PROVIDER_ID, LIBRARY_VOICE } from "./voice.ts";
import type { LibraryEntry } from "./entries.ts";

/**
 * Tạo MỘT tệp giọng máy cho MỘT lời đọc cố định và đăng ký ở trạng thái "chờ duyệt" (lõi thuần, phụ thuộc được tiêm vào để kiểm thử
 * không cần Storage/CSDL/mạng). Chỉ chạy khi giáo viên bấm "Tạo âm thanh" — KHÔNG gọi khi học sinh học, khi mở bài hay khi tải trang.
 *
 *   1. thư viện đã bật (cờ hệ thống) và lời đọc ĐÃ được giáo viên duyệt (khớp bản băm nội dung hiện hành) — chưa duyệt thì KHÔNG gọi dịch vụ;
 *   2. chưa có bản đang chờ/đang dùng cùng khóa tệp (chống tạo trùng, chống tốn chi phí);
 *   3. nhà cung cấp là `none` → NO_PROVIDER, không gọi mạng; chỉ yêu cầu {chữ, mục đích, mã giọng, tốc độ} — KHÔNG dữ liệu học sinh;
 *   4. tệp trả về qua kiểm tra theo NỘI DUNG (định dạng thật, thời lượng, dung lượng); mock/byte giả bị loại;
 *   5. máy chủ sinh khóa đối tượng từ UUID → lưu (không ghi đè) → đăng ký bằng hàm CSDL; đăng ký lỗi → gỡ tệp vừa lưu (không để mồ côi).
 * Không bao giờ tự duyệt: kết quả luôn là bản chờ duyệt.
 */

export type GenerateDeps = {
  schoolId: string;
  provider: TtsProvider;
  newId: () => string;
  libraryEnabled: () => Promise<Result<boolean>>;
  scriptApproved: (entry: LibraryEntry) => Promise<Result<boolean>>;
  liveVersionExists: (entry: LibraryEntry) => Promise<Result<boolean>>;
  putObject: (key: string, bytes: Uint8Array, contentType: string) => Promise<Result<null>>;
  removeObject: (key: string) => Promise<void>;
  register: (args: {
    versionId: string;
    entry: LibraryEntry;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    durationMs: number;
    contentSha256: string;
  }) => Promise<Result<{ versionNo: number }>>;
  timeoutMs?: number;
};

export type GeneratedVersion = { versionId: string; versionNo: number; durationMs: number };

const EXTENSION: Record<string, string> = { "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg" };

/** Mã lỗi của cổng TTS → mã của ứng dụng (không chuyển nguyên văn lỗi nhà cung cấp). */
export function mapTtsError(code: TtsErrorCode): ErrorCode {
  switch (code) {
    case "NO_PROVIDER":
      return "NO_PROVIDER";
    case "TIMEOUT":
    case "PROVIDER_ERROR":
      return "PROVIDER_ERROR";
    case "BUDGET_EXCEEDED":
      return "BUDGET_EXCEEDED";
    default:
      return "INVALID_INPUT";
  }
}

export async function generateLine(deps: GenerateDeps, entry: LibraryEntry): Promise<Result<GeneratedVersion>> {
  const enabled = await deps.libraryEnabled();
  if (!enabled.ok) return enabled;
  if (!enabled.data) return fail("TTS_LIBRARY_DISABLED");

  const approved = await deps.scriptApproved(entry);
  if (!approved.ok) return approved;
  if (!approved.data) return fail("SCRIPT_NOT_APPROVED");

  const live = await deps.liveVersionExists(entry);
  if (!live.ok) return live;
  if (live.data) return fail("ALREADY_GENERATED");

  if (deps.provider.id === "none") return fail("NO_PROVIDER");

  const outcome = await synthesizeSpeech({
    provider: deps.provider,
    request: { text: entry.text, purpose: entry.purpose, voiceKey: LIBRARY_VOICE.voiceKey, speed: LIBRARY_VOICE.speed },
    budget: new CharBudget(LIBRARY_CALL_CHAR_LIMIT),
    ...(deps.timeoutMs ? { timeoutMs: deps.timeoutMs } : {}),
  });
  if (!outcome.ok) return fail(mapTtsError(outcome.code));

  const checked = checkSynthesizedAudio(outcome.data);
  if (!checked.ok) return fail("AUDIO_INVALID");
  const extension = EXTENSION[checked.audio.mime];
  if (!extension) return fail("AUDIO_UNSUPPORTED");

  const versionId = deps.newId();
  const storageKey = `${deps.schoolId}/${versionId}.${extension}`;
  const stored = await deps.putObject(storageKey, outcome.data.bytes, checked.audio.mime);
  if (!stored.ok) return stored;

  const registered = await deps.register({
    versionId,
    entry,
    storageKey,
    mimeType: checked.audio.mime,
    sizeBytes: checked.audio.byteLength,
    durationMs: checked.audio.durationMs,
    contentSha256: checked.audio.sha256,
  });
  if (!registered.ok) {
    await deps.removeObject(storageKey);
    return registered;
  }
  return ok({ versionId, versionNo: registered.data.versionNo, durationMs: checked.audio.durationMs });
}

export { LIBRARY_PROVIDER_ID };
