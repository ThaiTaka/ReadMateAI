import { POC_SENTENCE_SETS, type PocSentenceSet } from "./sentences.ts";
import { DEFAULT_POC_VOICES, isPocVoiceKey, POC_VOICES, type PocProviderId, type PocVoiceKey } from "./voices.ts";

/**
 * Đọc đối số và quyết định chế độ của công cụ `npm run tts:poc` (R10.3b2-P0). HÀM THUẦN: môi trường được truyền vào
 * (do script gọi truyền vào), nên unit test được mọi nhánh mà không cần khóa thật.
 *
 * Mặc định là CHẠY KHÔ. Gọi API thật cần ĐỒNG THỜI: cờ `--live`, `TTS_POC_COST_CONFIRMED=yes` (người vận hành xác nhận đã
 * kiểm tra quota/thanh toán), và khóa của từng nhà cung cấp. Thiếu bất kỳ điều kiện nào → không gọi mạng.
 */

export type PocCliOptions = {
  live: boolean;
  voices: PocVoiceKey[];
  set: PocSentenceSet;
  speed: "slow" | "normal";
  format: "mp3" | "wav";
  maxRequests: number | undefined;
};

export type ParseResult = { ok: true; options: PocCliOptions } | { ok: false; error: string };

/** Giọng Viettel chỉ lấy MP3 (`tts_return_option` = 3 là giá trị duy nhất xác minh được); không âm thầm đổi định dạng. */
const WAV_UNSUPPORTED = "--format wav chưa hỗ trợ cho giọng Viettel (chỉ mp3)";

export function parsePocArgs(argv: readonly string[]): ParseResult {
  const options: PocCliOptions = {
    live: false,
    voices: [...DEFAULT_POC_VOICES],
    set: "catalog",
    speed: "normal",
    format: "mp3",
    maxRequests: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    const value = (): string | undefined => argv[++index];
    switch (arg) {
      case "--live":
        options.live = true;
        break;
      case "--voices": {
        const raw = value() ?? "";
        const keys = raw.split(",").map((part) => part.trim());
        const bad = keys.find((key) => !isPocVoiceKey(key));
        if (bad !== undefined || keys.length === 0) return { ok: false, error: `Giọng không hợp lệ: "${bad ?? raw}"` };
        options.voices = keys as PocVoiceKey[];
        break;
      }
      case "--set": {
        const raw = value() ?? "";
        if (!(raw in POC_SENTENCE_SETS)) return { ok: false, error: `Bộ câu không hợp lệ: "${raw}"` };
        options.set = raw as PocSentenceSet;
        break;
      }
      case "--speed": {
        const raw = value();
        if (raw !== "slow" && raw !== "normal") return { ok: false, error: "--speed chỉ nhận slow hoặc normal" };
        options.speed = raw;
        break;
      }
      case "--format": {
        const raw = value();
        if (raw !== "mp3" && raw !== "wav") return { ok: false, error: "--format chỉ nhận mp3 hoặc wav" };
        options.format = raw;
        break;
      }
      case "--max-requests": {
        const parsed = Number(value());
        if (!Number.isInteger(parsed) || parsed < 1)
          return { ok: false, error: "--max-requests phải là số nguyên ≥ 1" };
        options.maxRequests = parsed;
        break;
      }
      default:
        return { ok: false, error: `Đối số không được hỗ trợ: "${arg}"` };
    }
  }
  if (options.format === "wav" && options.voices.some((key) => POC_VOICES[key].provider === "viettel")) {
    return { ok: false, error: WAV_UNSUPPORTED };
  }
  return { ok: true, options };
}

export const VIETTEL_KEY_ENV = "TTS_VIETTEL_TOKEN";
export const FPT_KEY_ENV = "TTS_FPT_API_KEY";
export const GOOGLE_KEY_ENV = "TTS_GOOGLE_API_KEY";
export const COST_CONFIRM_ENV = "TTS_POC_COST_CONFIRMED";

export type PocEnv = Readonly<Record<string, string | undefined>>;

/**
 * Token Viettel dùng làm giá trị tiêu đề HTTP nên phải là ký tự ASCII in được, không khoảng trắng, độ dài hợp lý. Sai dạng được
 * coi như CHƯA CÓ token (không in giá trị ra); đây chỉ là kiểm tra dạng, không chứng minh token còn hiệu lực.
 */
export const isUsableViettelToken = (value: string | undefined): value is string =>
  value !== undefined && /^[!-~]{8,512}$/u.test(value);

export type PocMode =
  | { mode: "dry"; reason: "NOT_LIVE" }
  | { mode: "refused"; reason: "COST_NOT_CONFIRMED" }
  | { mode: "no_keys"; missing: PocProviderId[] }
  | {
      mode: "live";
      keys: Partial<Record<PocProviderId, string>>;
      /** Giọng bị bỏ qua vì thiếu khóa của nhà cung cấp. */
      skippedVoices: PocVoiceKey[];
      voices: PocVoiceKey[];
    };

export function decidePocMode(options: PocCliOptions, env: PocEnv): PocMode {
  if (!options.live) return { mode: "dry", reason: "NOT_LIVE" };
  if (env[COST_CONFIRM_ENV]?.trim() !== "yes") return { mode: "refused", reason: "COST_NOT_CONFIRMED" };
  const keys: Partial<Record<PocProviderId, string>> = {};
  const viettel = env[VIETTEL_KEY_ENV]?.trim();
  const fpt = env[FPT_KEY_ENV]?.trim();
  const google = env[GOOGLE_KEY_ENV]?.trim();
  if (isUsableViettelToken(viettel)) keys.viettel = viettel;
  if (fpt) keys.fpt = fpt;
  if (google) keys.google = google;
  const voices = options.voices.filter((key) => keys[POC_VOICES[key].provider] !== undefined);
  const skippedVoices = options.voices.filter((key) => !voices.includes(key));
  if (voices.length === 0) {
    const missing = [...new Set(options.voices.map((key) => POC_VOICES[key].provider))];
    return { mode: "no_keys", missing };
  }
  return { mode: "live", keys, skippedVoices, voices };
}
