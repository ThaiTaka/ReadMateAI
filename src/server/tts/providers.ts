import type { SynthesizeOptions, TtsOutcome, TtsProvider, TtsRequest } from "./types.ts";

/** Không có nhà cung cấp (hoặc thiếu khóa): ứng dụng vẫn chạy, mọi yêu cầu trả `NO_PROVIDER`, không gọi mạng. */
export const noneProvider: TtsProvider = {
  id: "none",
  external: false,
  synthesize: async () => ({ ok: false, code: "NO_PROVIDER" }),
};

/**
 * Tệp "âm thanh" giả cho kiểm thử: tiêu đề cố định + số ký tự; KHÔNG phải âm thanh thật, không bao giờ phát. Nhãn
 * `audio/mpeg` chỉ để khớp kiểu; `checkSynthesizedAudio` (audio-check.ts) từ chối các byte này, nên chúng không thể
 * thành ứng viên hay phiên bản đã duyệt. Cần tệp phát được trong kiểm thử: dùng WAV tổng hợp (tests/unit/audio-library/fixtures.ts).
 */
export function createMockProvider(
  behavior: { fail?: "PROVIDER_ERROR" | "TIMEOUT" } = {},
): TtsProvider & { readonly calls: TtsRequest[] } {
  const calls: TtsRequest[] = [];
  return {
    id: "mock",
    external: false,
    calls,
    synthesize: async (request): Promise<TtsOutcome> => {
      calls.push(request);
      if (behavior.fail) return { ok: false, code: behavior.fail };
      const bytes = new TextEncoder().encode(`MOCK-TTS:${request.voiceKey}:${request.text.length}`);
      return { ok: true, data: { bytes, mimeType: "audio/mpeg" } };
    },
  };
}

/**
 * Google Cloud Text-to-Speech, REST `v1/text:synthesize` (docs.cloud.google.com/text-to-speech/docs/reference/rest).
 * CHƯA kiểm chứng với API thật (chưa có khóa được cấp phép — docs/AUDIO_ENGINE.md §3.6); chỉ kiểm thử bằng `fetch` giả.
 * Khóa API chỉ ở máy chủ; không ghi log nội dung/khóa; không theo chuyển hướng.
 */
const GOOGLE_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

/** Ánh xạ khóa giọng nội bộ → giọng Google. Neural2 chọn làm mặc định POC (chi phí thấp hơn Chirp 3 HD, hỗ trợ tốc độ đọc). */
const GOOGLE_VOICES: Readonly<Record<string, string>> = {
  "vi-female-1": "vi-VN-Neural2-A",
  "vi-male-1": "vi-VN-Neural2-D",
  // Khóa nghe thử (R10.3b2-P0): cùng giọng, tên khóa nói rõ nhà cung cấp để bảng so sánh không nhầm.
  "google-neural2-a": "vi-VN-Neural2-A",
  "google-neural2-d": "vi-VN-Neural2-D",
};

/** `wav` = LINEAR16 (Google trả tệp WAV có tiêu đề) — để nghe thử chất lượng trên trình duyệt (R10.3b2-P0). */
export function createGoogleProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  format: "mp3" | "wav" = "mp3",
): TtsProvider {
  return {
    id: "google",
    external: true,
    synthesize: async (request, { signal }: SynthesizeOptions): Promise<TtsOutcome> => {
      const voice = GOOGLE_VOICES[request.voiceKey];
      if (!voice) return { ok: false, code: "INVALID_INPUT" };
      try {
        const response = await fetchImpl(GOOGLE_ENDPOINT, {
          method: "POST",
          redirect: "error",
          signal,
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            input: { text: request.text },
            voice: { languageCode: "vi-VN", name: voice },
            audioConfig: {
              audioEncoding: format === "wav" ? "LINEAR16" : "MP3",
              speakingRate: request.speed === "slow" ? 0.8 : 1,
            },
          }),
        });
        if (!response.ok) return { ok: false, code: "PROVIDER_ERROR" };
        const body: unknown = await response.json();
        const content =
          typeof body === "object" && body !== null && "audioContent" in body
            ? (body as { audioContent: unknown }).audioContent
            : null;
        if (typeof content !== "string" || content.length === 0) return { ok: false, code: "PROVIDER_ERROR" };
        return {
          ok: true,
          data: {
            bytes: new Uint8Array(Buffer.from(content, "base64")),
            mimeType: format === "wav" ? "audio/wav" : "audio/mpeg",
          },
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return { ok: false, code: "TIMEOUT" };
        return { ok: false, code: "PROVIDER_ERROR" };
      }
    },
  };
}
