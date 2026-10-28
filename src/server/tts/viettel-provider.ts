import { POC_VOICES, type PocVoiceKey } from "./poc/voices.ts";
import { readCapped } from "./read-capped.ts";
import type { SynthesizeOptions, TtsAudio, TtsOutcome, TtsProvider } from "./types.ts";

/**
 * Viettel AI Text-to-Speech — adapter THỬ NGHIỆM (R10.3b2-P0b). CHƯA kiểm chứng với API thật (chưa có token được cấp);
 * chỉ kiểm thử bằng `fetch` giả.
 *
 * NGUỒN GIAO THỨC (đối chiếu 2026-10-28): trang tài liệu chính thức https://viettelai.vn/en/tai-lieu là ứng dụng Nuxt
 * dựng bằng JavaScript nên KHÔNG đọc được phần mô tả API bằng công cụ tải trang. Các điểm dưới đây được lấy từ MÃ CHẠY của
 * chính trang web Viettel AI (phần "trải nghiệm TTS" trong gói JavaScript do viettelai.vn phục vụ), tức là cách khách hàng
 * chính thức của dịch vụ gọi API, KHÔNG phải trang đặc tả chính thức:
 *   POST https://viettelai.vn/tts/speech_synthesis
 *   tiêu đề  `Content-Type: application/json`, `token: <token>`
 *   thân     { "speed": 1, "voice": "hcm-minhquan", "text": "…", "tts_return_option": 3, "without_filter": false }
 *   phản hồi byte âm thanh (mã chạy đặt tên tệp `audio.mp3`); lỗi là JSON, 429 = hết lượt dùng thử
 * Chưa xác minh được: ý nghĩa chính thức của `tts_return_option` (nguồn thứ ba: 1 = luồng, 2 = wav, 3 = mp3; mã chạy chỉ dùng 3),
 * `without_filter`, dải `speed` cho API trả phí (giao diện thử chỉ cho 0,8–1,2), trần ký tự cho API trả phí (giao diện thử: 300),
 * hạn mức/đơn giá. Vì vậy adapter chỉ dùng mp3, chỉ tốc độ 0,9–1, tối đa 300 ký tự, và KHÔNG tin phản hồi 200: mọi tệp phải qua
 * `checkSynthesizedAudio` (nhận dạng theo nội dung) trước khi lưu.
 *
 * An toàn: token chỉ nằm trong tiêu đề yêu cầu; không ghi log, không đưa vào lỗi hay chẩn đoán; thân phản hồi lỗi không được
 * đọc hay đưa vào chẩn đoán (có thể chứa nội dung do nhà cung cấp viết).
 */

export const VIETTEL_ENDPOINT = "https://viettelai.vn/tts/speech_synthesis";
/**
 * Khóa giọng NỘI BỘ dùng cho thư viện sản xuất (R10.5) → mã giọng của Viettel AI. `vi-male-1` = `hcm-minhquan` (nam, miền Nam): giọng THỬ do chủ
 * dự án chọn sau khi nghe trên giao diện của nhà cung cấp — KHÔNG thay bước giáo viên NGHE và duyệt từng tệp (quyết định G1–G3 vẫn là của giáo viên).
 */
const VIETTEL_PRODUCTION_VOICES: Readonly<Record<string, string>> = { "vi-male-1": "hcm-minhquan" };
export const VIETTEL_SUGGESTED_TIMEOUT_MS = 30_000;
export const VIETTEL_MAX_AUDIO_BYTES = 2_000_000;
export const VIETTEL_MIN_CHARS = 1;
/** Trần của giao diện thử chính thức; chưa có cam kết cho API trả phí nên giữ trần thấp hơn hoặc bằng. */
export const VIETTEL_MAX_CHARS = 300;
/** Mã `tts_return_option` mà chính trang Viettel AI dùng để lấy MP3. */
const VIETTEL_RETURN_MP3 = 3;

/** Tốc độ Viettel (giao diện thử: 0,8…1,2, bước 0,1). "Chậm vừa phải" = một bước chậm hơn — chưa phải quyết định của giáo viên (G3). */
const VIETTEL_SPEED = { slow: 0.9, normal: 1 } as const;

export type ViettelDiagnostic =
  | "HTTP_UNAUTHORIZED"
  | "HTTP_RATE_LIMITED"
  | "HTTP_ERROR"
  | "API_ERROR"
  | "BAD_RESPONSE"
  | "EMPTY_AUDIO"
  | "AUDIO_TOO_LARGE";

export type ViettelProviderOptions = {
  /** Token Viettel AI (`TTS_VIETTEL_TOKEN`). Chỉ nằm trong tiêu đề `token`. */
  token: string;
  fetchImpl?: typeof fetch;
  maxAudioBytes?: number;
  /** Nhận MÃ chẩn đoán cố định + mã trạng thái HTTP (nếu có); không bao giờ nhận token, nội dung hay phản hồi thô. */
  onDiagnostic?: (reason: ViettelDiagnostic, detail?: string) => void;
};

const isAbort = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";

/** Byte đầu của tệp trông như JSON/HTML (lỗi trả về với mã 200 hoặc nhãn âm thanh sai). MP3 bắt đầu bằng 0xFF hoặc "ID3". */
function looksLikeText(bytes: Uint8Array): boolean {
  const first = bytes.find((byte) => byte !== 0x20 && byte !== 0x0a && byte !== 0x0d && byte !== 0x09);
  return first === 0x7b || first === 0x5b || first === 0x3c;
}

export function createViettelProvider(options: ViettelProviderOptions): TtsProvider {
  const { token, fetchImpl = fetch, maxAudioBytes = VIETTEL_MAX_AUDIO_BYTES, onDiagnostic } = options;
  const note = (reason: ViettelDiagnostic, detail?: string) => onDiagnostic?.(reason, detail);

  return {
    id: "viettel",
    external: true,
    synthesize: async (request, { signal }: SynthesizeOptions): Promise<TtsOutcome> => {
      const pocVoice = POC_VOICES[request.voiceKey as PocVoiceKey];
      const providerVoice =
        VIETTEL_PRODUCTION_VOICES[request.voiceKey] ??
        (pocVoice?.provider === "viettel" ? pocVoice.providerVoice : null);
      if (!providerVoice) return { ok: false, code: "INVALID_INPUT" };
      if (request.text.length < VIETTEL_MIN_CHARS || request.text.length > VIETTEL_MAX_CHARS) {
        return { ok: false, code: "INVALID_INPUT" };
      }
      try {
        const response = await fetchImpl(VIETTEL_ENDPOINT, {
          method: "POST",
          redirect: "error",
          signal,
          headers: { "Content-Type": "application/json", Accept: "audio/*", token },
          body: JSON.stringify({
            speed: VIETTEL_SPEED[request.speed],
            voice: providerVoice,
            text: request.text,
            tts_return_option: VIETTEL_RETURN_MP3,
            without_filter: false,
          }),
        });
        if (!response.ok) {
          await response.body?.cancel();
          const status = response.status;
          note(
            status === 401 || status === 403
              ? "HTTP_UNAUTHORIZED"
              : status === 429
                ? "HTTP_RATE_LIMITED"
                : "HTTP_ERROR",
            String(status),
          );
          return { ok: false, code: "PROVIDER_ERROR" };
        }
        const type = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (type.includes("json")) {
          await response.body?.cancel();
          note("API_ERROR");
          return { ok: false, code: "PROVIDER_ERROR" };
        }
        if (type !== "" && !type.startsWith("audio/") && !type.startsWith("application/octet-stream")) {
          await response.body?.cancel();
          note("BAD_RESPONSE");
          return { ok: false, code: "PROVIDER_ERROR" };
        }
        const bytes = await readCapped(response, maxAudioBytes);
        if (bytes === "TOO_LARGE") {
          note("AUDIO_TOO_LARGE");
          return { ok: false, code: "PROVIDER_ERROR" };
        }
        if (bytes.byteLength === 0) {
          note("EMPTY_AUDIO");
          return { ok: false, code: "PROVIDER_ERROR" };
        }
        if (looksLikeText(bytes)) {
          note("API_ERROR");
          return { ok: false, code: "PROVIDER_ERROR" };
        }
        const audio: TtsAudio = { bytes, mimeType: "audio/mpeg" };
        return { ok: true, data: audio };
      } catch (error) {
        if (isAbort(error)) return { ok: false, code: "TIMEOUT" };
        return { ok: false, code: "PROVIDER_ERROR" };
      }
    },
  };
}
