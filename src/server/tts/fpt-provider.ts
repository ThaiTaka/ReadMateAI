import { POC_VOICES, type PocVoiceKey } from "./poc/voices.ts";
import type { SynthesizeOptions, TtsAudio, TtsOutcome, TtsProvider } from "./types.ts";

/**
 * FPT.AI Text-to-Speech v5 (docs.fpt.ai/docs/en/speech/api/text-to-speech, đối chiếu 2026-10-28) — adapter THỬ NGHIỆM
 * (R10.3b2-P0). CHƯA kiểm chứng với API thật (chưa có khóa được cấp); chỉ kiểm thử bằng `fetch` giả.
 *
 * Giao thức theo tài liệu: `POST https://api.fpt.ai/hmi/tts/v5`, tiêu đề `api_key` (gạch DƯỚI), `voice`, `speed` (-3…+3),
 * `format` (mp3|wav); thân yêu cầu là văn bản (3–5.000 ký tự). Phản hồi JSON `{ error, async, message, request_id }`:
 * `error = 0` là thành công và `async` là liên kết tệp, tệp có thể CHƯA có khi phản hồi trả về (tài liệu: khoảng 5 giây tới
 * 2 phút) nên adapter hỏi lại theo số lần và thời gian có hạn. Không dùng `callback_url` (cần địa chỉ công khai).
 *
 * An toàn: liên kết `async` do máy chủ nhà cung cấp trả về là ĐẦU VÀO KHÔNG TIN CẬY → chỉ tải khi qua `checkFptAudioUrl`
 * (https, tên miền trong danh sách cho phép, không IP/cổng/tài khoản trong địa chỉ), không theo chuyển hướng, giới hạn dung
 * lượng. Khóa API chỉ nằm trong tiêu đề yêu cầu; không ghi log, không đưa vào lỗi hay chẩn đoán.
 */

export const FPT_ENDPOINT = "https://api.fpt.ai/hmi/tts/v5";
/** Thời gian chờ tổng đề nghị cho `synthesizeSpeech` khi dùng adapter này (tài liệu: tệp có thể mất tới 2 phút). */
export const FPT_SUGGESTED_TIMEOUT_MS = 150_000;
export const FPT_MAX_POLLS = 24;
export const FPT_MAX_AUDIO_BYTES = 2_000_000;
export const FPT_MIN_CHARS = 3;
export const FPT_MAX_CHARS = 5000;

/** Tốc độ FPT: -3 (chậm nhất) … +3. "Chậm vừa phải" = -1 — chưa phải quyết định của giáo viên (G3). */
const FPT_SPEED = { slow: "-1", normal: "0" } as const;

/**
 * Tên miền được phép tải tệp. Ví dụ trong tài liệu là S3 vùng ap-southeast-1 (`s3-ap-southeast-1.amazonaws.com`, đường dẫn
 * `text2speech-v4`); tài liệu KHÔNG cam kết tên miền này nên mọi tên miền khác bị từ chối (an toàn) cho tới khi có lần chạy
 * thật xác nhận và được thêm vào đây có chủ đích.
 */
const ALLOWED_HOSTS: readonly RegExp[] = [
  /^(?:[a-z0-9][a-z0-9.-]{0,62}\.)?s3[.-]ap-southeast-1\.amazonaws\.com$/u,
  /^(?:[a-z0-9-]+\.)*fpt\.ai$/u,
];

/** Trả URL đã kiểm tra hoặc `null`. Hàm thuần, có unit test. */
export function checkFptAudioUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.port !== "") return null;
  const host = url.hostname.toLowerCase();
  // IP (v4/v6) và tên không có dấu chấm (localhost, tên nội bộ) không bao giờ nằm trong danh sách.
  if (host.includes(":") || host.startsWith("[") || /^\d+(?:\.\d+){3}$/u.test(host) || !host.includes(".")) return null;
  if (!ALLOWED_HOSTS.some((pattern) => pattern.test(host))) return null;
  return url;
}

export type FptDiagnostic =
  | "HTTP_ERROR"
  | "HTTP_RATE_LIMITED"
  | "API_ERROR"
  | "BAD_RESPONSE"
  | "URL_REJECTED"
  | "AUDIO_TOO_LARGE"
  | "AUDIO_NOT_READY_IN_TIME";

export type FptProviderOptions = {
  apiKey: string;
  format?: "mp3" | "wav";
  fetchImpl?: typeof fetch;
  /** Có thể thay trong kiểm thử; phải tôn trọng `signal`. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  maxPolls?: number;
  maxAudioBytes?: number;
  /**
   * Nhận MÃ chẩn đoán cố định (không khóa, không nội dung, không phản hồi thô). `detail` chỉ là mã trạng thái HTTP hoặc tên
   * miền bị từ chối — dùng để người vận hành biết nên cập nhật danh sách tên miền hay kiểm tra quota.
   */
  onDiagnostic?: (reason: FptDiagnostic, detail?: string) => void;
};

const defaultSleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

function abortError(): Error {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

/** Chờ tăng dần 2 → 6 giây: 24 lần ≈ 2 phút 14 giây, đủ khoảng chờ tối đa mà tài liệu nêu. */
const pollDelayMs = (attempt: number): number => Math.min(2000 + attempt * 1000, 6000);

async function readCapped(response: Response, limit: number): Promise<Uint8Array | "TOO_LARGE"> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return "TOO_LARGE";
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    return buffer.byteLength > limit ? "TOO_LARGE" : buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return "TOO_LARGE";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

const isAbort = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";

export function createFptProvider(options: FptProviderOptions): TtsProvider {
  const {
    apiKey,
    format = "mp3",
    fetchImpl = fetch,
    sleep = defaultSleep,
    maxPolls = FPT_MAX_POLLS,
    maxAudioBytes = FPT_MAX_AUDIO_BYTES,
    onDiagnostic,
  } = options;
  const mimeType: TtsAudio["mimeType"] = format === "wav" ? "audio/wav" : "audio/mpeg";
  const note = (reason: FptDiagnostic, detail?: string) => onDiagnostic?.(reason, detail);

  return {
    id: "fpt",
    external: true,
    synthesize: async (request, { signal }: SynthesizeOptions): Promise<TtsOutcome> => {
      const voice = POC_VOICES[request.voiceKey as PocVoiceKey];
      if (!voice || voice.provider !== "fpt") return { ok: false, code: "INVALID_INPUT" };
      if (request.text.length < FPT_MIN_CHARS || request.text.length > FPT_MAX_CHARS) {
        return { ok: false, code: "INVALID_INPUT" };
      }
      try {
        const response = await fetchImpl(FPT_ENDPOINT, {
          method: "POST",
          redirect: "error",
          signal,
          headers: {
            api_key: apiKey,
            voice: voice.providerVoice,
            speed: FPT_SPEED[request.speed],
            format,
            "Cache-Control": "no-cache",
          },
          body: request.text,
        });
        if (!response.ok) {
          note(response.status === 429 ? "HTTP_RATE_LIMITED" : "HTTP_ERROR", String(response.status));
          return { ok: false, code: "PROVIDER_ERROR" };
        }
        const body: unknown = await response.json();
        if (typeof body !== "object" || body === null) {
          note("BAD_RESPONSE");
          return { ok: false, code: "PROVIDER_ERROR" };
        }
        const { error, async: link } = body as { error?: unknown; async?: unknown };
        if (error !== 0) {
          note("API_ERROR");
          return { ok: false, code: "PROVIDER_ERROR" };
        }
        const audioUrl = checkFptAudioUrl(link);
        if (!audioUrl) {
          note("URL_REJECTED", safeHost(link));
          return { ok: false, code: "PROVIDER_ERROR" };
        }

        for (let attempt = 0; attempt < maxPolls; attempt += 1) {
          await sleep(pollDelayMs(attempt), signal);
          const file = await fetchImpl(audioUrl, {
            method: "GET",
            redirect: "error",
            signal,
            headers: { accept: "audio/*" },
          });
          // S3 trả 403/404 khi đối tượng chưa được ghi: coi là "chưa xong", không phải lỗi.
          if (file.status === 403 || file.status === 404) {
            await file.body?.cancel();
            continue;
          }
          if (!file.ok) {
            await file.body?.cancel();
            note("HTTP_ERROR", String(file.status));
            return { ok: false, code: "PROVIDER_ERROR" };
          }
          const type = file.headers.get("content-type")?.toLowerCase() ?? "";
          if (type !== "" && !type.startsWith("audio/") && !type.startsWith("application/octet-stream")) {
            await file.body?.cancel();
            note("BAD_RESPONSE");
            return { ok: false, code: "PROVIDER_ERROR" };
          }
          const bytes = await readCapped(file, maxAudioBytes);
          if (bytes === "TOO_LARGE") {
            note("AUDIO_TOO_LARGE");
            return { ok: false, code: "PROVIDER_ERROR" };
          }
          if (bytes.byteLength === 0) continue;
          return { ok: true, data: { bytes, mimeType } };
        }
        note("AUDIO_NOT_READY_IN_TIME");
        return { ok: false, code: "TIMEOUT" };
      } catch (error) {
        if (isAbort(error)) return { ok: false, code: "TIMEOUT" };
        return { ok: false, code: "PROVIDER_ERROR" };
      }
    },
  };
}

function safeHost(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    return new URL(raw).hostname.toLowerCase().slice(0, 100);
  } catch {
    return undefined;
  }
}
